import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { selectedRouteIdAtom, drawingRouteIdAtom, routePathAtomFamily } from "../state/computed";
import { beginDragAtom, setDragPointAtom, endDragAtom, insertPointAtom, deletePointAtom, selectRouteAtom } from "../state/actions";
import { PALETTE, Point, Route } from "../state/types";

type Props = {
  route: Route;
  imageWidth: number;
  imageHeight: number;
  svgRef: React.RefObject<SVGSVGElement>;
};

function clientToNormalized(e: { clientX: number; clientY: number }, svg: SVGSVGElement, w: number, h: number): Point {
  const rect = svg.getBoundingClientRect();
  const scale = Math.min(rect.width / w, rect.height / h);
  const renderedW = w * scale;
  const renderedH = h * scale;
  const offsetX = (rect.width - renderedW) / 2;
  const offsetY = (rect.height - renderedH) / 2;
  const px = (e.clientX - rect.left - offsetX) / scale;
  const py = (e.clientY - rect.top - offsetY) / scale;
  return { x: px / w, y: py / h };
}

export function RouteShape({ route, imageWidth, imageHeight, svgRef }: Props) {
  const selectedId = useAtomValue(selectedRouteIdAtom);
  const drawingId = useAtomValue(drawingRouteIdAtom);
  const pathD = useAtomValue(routePathAtomFamily(route.id));
  const selectRoute = useSetAtom(selectRouteAtom);
  const beginDrag = useSetAtom(beginDragAtom);
  const setDragPoint = useSetAtom(setDragPointAtom);
  const endDrag = useSetAtom(endDragAtom);
  const insertPoint = useSetAtom(insertPointAtom);
  const deletePoint = useSetAtom(deletePointAtom);

  const isSelected = selectedId === route.id;
  const isDrawing = drawingId === route.id;
  const startColor = PALETTE[route.color];
  const numColor = route.color === "white" ? "#000" : "#fff";

  const dragPointerIdRef = useRef<number | null>(null);

  // Pixel-space points used for circles and hit-testing. The path string itself is the
  // result of routePathAtomFamily — pre-computed and only invalidates when this route changes.
  const pixelPoints = route.points.map((p) => ({ x: p.x * imageWidth, y: p.y * imageHeight }));
  const start = pixelPoints[0];
  const end = pixelPoints[pixelPoints.length - 1];

  const baseSize = Math.min(imageWidth, imageHeight);
  const lineWidth = baseSize * 0.002;
  const startR = baseSize * 0.022;
  const startFontSize = baseSize * 0.025;
  const endR = baseSize * 0.010;
  const handleR = baseSize * 0.012;
  const hitWidth = baseSize * 0.025;

  const onLineClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSelected) {
      selectRoute(route.id);
      return;
    }
    if (isDrawing || !svgRef.current) return;
    const np = clientToNormalized(e, svgRef.current, imageWidth, imageHeight);
    const clickPx = { x: np.x * imageWidth, y: np.y * imageHeight };
    let bestIdx = 1;
    let bestDist = Infinity;
    for (let i = 0; i < pixelPoints.length - 1; i++) {
      const d = pointSegmentDistance(clickPx, pixelPoints[i], pixelPoints[i + 1]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i + 1;
      }
    }
    insertPoint({ routeId: route.id, index: bestIdx, point: np });
  };

  const onHandleDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragPointerIdRef.current = e.pointerId;
    beginDrag({ routeId: route.id, pointIndex: index });
  };

  const onHandleMove = (e: React.PointerEvent) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    if (!svgRef.current) return;
    setDragPoint(clientToNormalized(e, svgRef.current, imageWidth, imageHeight));
  };

  const onHandleUp = (e: React.PointerEvent) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    dragPointerIdRef.current = null;
    endDrag();
  };

  const onHandleContextMenu = (e: React.MouseEvent, index: number) => {
    if (isDrawing) return;
    if (route.points.length <= 2) return;
    e.preventDefault();
    e.stopPropagation();
    deletePoint({ routeId: route.id, index });
  };

  return (
    <g>
      {/* Wide invisible hit target on the line */}
      {pathD && (
        <path
          d={pathD}
          stroke="transparent"
          strokeWidth={hitWidth}
          fill="none"
          style={{ cursor: isSelected ? (isDrawing ? "default" : "copy") : "pointer" }}
          onClick={onLineClick}
        />
      )}
      {pathD && (
        <path
          d={pathD}
          stroke="#fff"
          strokeWidth={lineWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}

      {end && pixelPoints.length >= 2 && (
        <circle
          cx={end.x}
          cy={end.y}
          r={endR}
          fill="#fff"
          pointerEvents="none"
        />
      )}

      {start && (
        <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); selectRoute(route.id); }}>
          <circle cx={start.x} cy={start.y} r={startR} fill={startColor} />
          <text
            x={start.x}
            y={start.y}
            fontSize={startFontSize}
            fill={numColor}
            textAnchor="middle"
            dominantBaseline="central"
            fontWeight="700"
            fontFamily='"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'
            pointerEvents="none"
            style={{ userSelect: "none" }}
          >
            {route.number}
          </text>
        </g>
      )}

      {isSelected &&
        pixelPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={handleR}
            fill="#fff"
            stroke="#000"
            strokeWidth={lineWidth * 0.5}
            opacity={0.85}
            style={{ cursor: "grab" }}
            onPointerDown={(e) => onHandleDown(e, i)}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            onContextMenu={(e) => onHandleContextMenu(e, i)}
          />
        ))}
    </g>
  );
}

function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
