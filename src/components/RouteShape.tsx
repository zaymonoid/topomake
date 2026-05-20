import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { selectedRouteIdAtom, drawingRouteIdAtom, dragOverrideForRouteAtomFamily } from "../state/computed";
import { beginDragAtom, setDragPointAtom, endDragAtom, insertPointAtom, deletePointAtom, selectRouteAtom } from "../state/actions";
import { PALETTE, Point, Route } from "../state/types";
import { catmullRomPath } from "../util/spline";

type Props = {
  route: Route;
  imageWidth: number;
  imageHeight: number;
  svgRef: React.RefObject<SVGSVGElement>;
};

function clientToNormalized(e: { clientX: number; clientY: number }, rect: DOMRect, w: number, h: number): Point {
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
  const dragOverride = useAtomValue(dragOverrideForRouteAtomFamily(route.id));
  const selectRoute = useSetAtom(selectRouteAtom);
  const beginDrag = useSetAtom(beginDragAtom);
  const setDragPoint = useSetAtom(setDragPointAtom);
  const endDrag = useSetAtom(endDragAtom);
  const insertPoint = useSetAtom(insertPointAtom);
  const deletePoint = useSetAtom(deletePointAtom);

  const isSelected = selectedId === route.id;
  const isDrawing = drawingId === route.id;
  const startColor = PALETTE[route.color];
  const numColor = route.color === "white" || route.color === "yellow" ? "#000" : "#fff";

  const dragPointerIdRef = useRef<number | null>(null);
  // Cached on pointerdown so per-frame moves don't force a layout flush.
  const dragRectRef = useRef<DOMRect | null>(null);

  const pixelPoints = route.points.map((p, i) => {
    const src = dragOverride && i === dragOverride.pointIndex ? dragOverride.point : p;
    return { x: src.x * imageWidth, y: src.y * imageHeight };
  });
  const pathD = catmullRomPath(pixelPoints);
  const start = pixelPoints[0];
  const end = pixelPoints[pixelPoints.length - 1];

  const baseSize = Math.min(imageWidth, imageHeight);
  const lineWidth = baseSize * 0.0035;
  const glowWidth = baseSize * 0.018;
  const selectedLineWidth = baseSize * 0.0045;
  const startR = baseSize * 0.018;
  const startFontSize = baseSize * 0.021;
  const endR = baseSize * 0.007;
  const handleR = baseSize * 0.013;
  const handleMidR = baseSize * 0.011;
  const handleStroke = baseSize * 0.003;
  const labelRingR = baseSize * 0.04;
  const labelRingStroke = baseSize * 0.004;
  const labelRingDash = baseSize * 0.007;
  const selectedDash = baseSize * 0.012;
  const selectedGap = baseSize * 0.008;
  const hitWidth = baseSize * 0.025;

  const onLineClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSelected) {
      selectRoute(route.id);
      return;
    }
    if (isDrawing || !svgRef.current) return;
    const np = clientToNormalized(e, svgRef.current.getBoundingClientRect(), imageWidth, imageHeight);
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
    if (!svgRef.current) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragPointerIdRef.current = e.pointerId;
    dragRectRef.current = svgRef.current.getBoundingClientRect();
    beginDrag({ routeId: route.id, pointIndex: index });
  };

  const onHandleMove = (e: React.PointerEvent) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    if (!dragRectRef.current) return;
    setDragPoint(clientToNormalized(e, dragRectRef.current, imageWidth, imageHeight));
  };

  const onHandleUp = (e: React.PointerEvent) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    dragPointerIdRef.current = null;
    dragRectRef.current = null;
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
      {/* Wide invisible hit target */}
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

      {/* Selection glow underneath */}
      {isSelected && pathD && (
        <path
          className="selected-glow"
          d={pathD}
          strokeWidth={glowWidth}
        />
      )}

      {/* Visible white line */}
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

      {/* Crisp dashed selection line on top */}
      {isSelected && pathD && (
        <path
          className="selected-line"
          d={pathD}
          strokeWidth={selectedLineWidth}
          strokeDasharray={`${selectedDash} ${selectedGap}`}
        />
      )}

      {/* End marker */}
      {end && pixelPoints.length >= 2 && route.finishStyle === "circle" && (
        <circle
          cx={end.x}
          cy={end.y}
          r={endR}
          fill="#fff"
          pointerEvents="none"
        />
      )}
      {end && pixelPoints.length >= 2 && route.finishStyle === "arrow" && (() => {
        const prev = pixelPoints[pixelPoints.length - 2];
        const dx = end.x - prev.x;
        const dy = end.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const size = baseSize * 0.016;
        // Tip sits exactly at the route end so the head connects to the line.
        const tipX = end.x;
        const tipY = end.y;
        // 35° half-angle wings, opening back along the line direction.
        const cos = Math.cos((35 * Math.PI) / 180);
        const sin = Math.sin((35 * Math.PI) / 180);
        const leftX = tipX - size * (ux * cos - uy * sin);
        const leftY = tipY - size * (uy * cos + ux * sin);
        const rightX = tipX - size * (ux * cos + uy * sin);
        const rightY = tipY - size * (uy * cos - ux * sin);
        return (
          <path
            d={`M ${leftX} ${leftY} L ${tipX} ${tipY} L ${rightX} ${rightY}`}
            fill="none"
            stroke="#fff"
            strokeWidth={lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        );
      })()}

      {/* Start chip with number */}
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

      {/* Dashed label ring around start chip when selected */}
      {isSelected && start && (
        <circle
          className="label-ring"
          cx={start.x}
          cy={start.y}
          r={labelRingR}
          strokeWidth={labelRingStroke}
          strokeDasharray={`${labelRingDash} ${labelRingDash}`}
          pointerEvents="none"
        />
      )}

      {/* Handles */}
      {isSelected &&
        pixelPoints.map((p, i) => {
          const isStart = i === 0;
          const isEnd = i === pixelPoints.length - 1;
          const cls = isStart ? "handle-start" : isEnd ? "handle-end" : "handle-mid";
          const r = isStart || isEnd ? handleR : handleMidR;
          return (
            <circle
              key={i}
              className={cls}
              cx={p.x}
              cy={p.y}
              r={r}
              strokeWidth={handleStroke}
              onPointerDown={(e) => onHandleDown(e, i)}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
              onContextMenu={(e) => onHandleContextMenu(e, i)}
            />
          );
        })}
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
