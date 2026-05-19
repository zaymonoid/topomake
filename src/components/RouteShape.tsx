import { useAtom, useSetAtom } from "jotai";
import { useRef } from "react";
import { selectedRouteIdAtom, drawingRouteIdAtom } from "../state/atoms";
import {
  beginInteractionAtom,
  setPointNoCommitAtom,
  insertPointAtom,
  deletePointAtom,
} from "../state/actions";
import { PALETTE, Point, Route } from "../state/types";
import { catmullRomPath } from "../util/spline";

type Props = {
  route: Route;
  imageWidth: number;
  imageHeight: number;
  svgRef: React.RefObject<SVGSVGElement>;
};

// Convert a pointer event to normalized [0,1] image coordinates using SVG viewBox math.
function clientToNormalized(e: { clientX: number; clientY: number }, svg: SVGSVGElement, w: number, h: number): Point {
  const rect = svg.getBoundingClientRect();
  // SVG viewBox is 0 0 w h with default preserveAspectRatio (xMidYMid meet).
  // Compute the actual content rect inside the SVG (letterboxed).
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
  const [selectedId, setSelectedId] = useAtom(selectedRouteIdAtom);
  const [drawingId] = useAtom(drawingRouteIdAtom);
  const beginInteraction = useSetAtom(beginInteractionAtom);
  const setPointNoCommit = useSetAtom(setPointNoCommitAtom);
  const insertPoint = useSetAtom(insertPointAtom);
  const deletePoint = useSetAtom(deletePointAtom);

  const isSelected = selectedId === route.id;
  const isDrawing = drawingId === route.id;
  const color = PALETTE[route.color];
  const numColor = route.color === "white" ? "#000" : "#fff";

  const dragRef = useRef<{ pointerId: number; index: number } | null>(null);

  // Convert normalized points to pixel-space points for path generation.
  const pixelPoints = route.points.map((p) => ({ x: p.x * imageWidth, y: p.y * imageHeight }));
  const pathD = catmullRomPath(pixelPoints);

  const start = pixelPoints[0];
  const end = pixelPoints[pixelPoints.length - 1];

  // Sizes scale with the image's smaller dimension so things look right at any image size.
  const baseSize = Math.min(imageWidth, imageHeight);
  const lineWidth = baseSize * 0.004;
  const haloWidth = lineWidth * 1.8;
  const startR = baseSize * 0.022;
  const startFontSize = baseSize * 0.025;
  const endR = baseSize * 0.012;
  const handleR = baseSize * 0.012;
  const hitWidth = baseSize * 0.025;

  const onLineClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSelected) {
      setSelectedId(route.id);
      return;
    }
    // If selected and not drawing, insert a new point at the clicked position
    // into the nearest segment.
    if (isDrawing || !svgRef.current) return;
    const np = clientToNormalized(e, svgRef.current, imageWidth, imageHeight);
    const clickPx = { x: np.x * imageWidth, y: np.y * imageHeight };
    // Find nearest segment between consecutive points.
    let bestIdx = 1;
    let bestDist = Infinity;
    for (let i = 0; i < pixelPoints.length - 1; i++) {
      const a = pixelPoints[i];
      const b = pixelPoints[i + 1];
      const d = pointSegmentDistance(clickPx, a, b);
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
    dragRef.current = { pointerId: e.pointerId, index };
    beginInteraction();
    setSelectedId(route.id);
  };

  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    if (!svgRef.current) return;
    const np = clientToNormalized(e, svgRef.current, imageWidth, imageHeight);
    setPointNoCommit({ routeId: route.id, index: dragRef.current.index, point: np });
  };

  const onHandleUp = (e: React.PointerEvent) => {
    if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const onHandleContextMenu = (e: React.MouseEvent, index: number) => {
    if (isDrawing) return;
    // Don't allow deleting the start or end while the route has only 2 points
    if (route.points.length <= 2) return;
    e.preventDefault();
    e.stopPropagation();
    deletePoint({ routeId: route.id, index });
  };

  return (
    <g>
      {/* Wider invisible hit target on the line */}
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
        <>
          <path
            d={pathD}
            stroke="#fff"
            strokeWidth={haloWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
          <path
            d={pathD}
            stroke={color}
            strokeWidth={lineWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        </>
      )}

      {/* End cap (small hollow circle) */}
      {end && pixelPoints.length >= 2 && (
        <>
          <circle
            cx={end.x}
            cy={end.y}
            r={endR}
            fill="none"
            stroke="#fff"
            strokeWidth={haloWidth}
            pointerEvents="none"
          />
          <circle
            cx={end.x}
            cy={end.y}
            r={endR}
            fill="none"
            stroke={color}
            strokeWidth={lineWidth}
            pointerEvents="none"
          />
        </>
      )}

      {/* Start circle with number — white halo behind, then colored fill, then number with stroke for legibility */}
      {start && (
        <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setSelectedId(route.id); }}>
          <circle cx={start.x} cy={start.y} r={startR + haloWidth / 2} fill="#fff" />
          <circle cx={start.x} cy={start.y} r={startR} fill={color} />
          <text
            x={start.x}
            y={start.y}
            fontSize={startFontSize}
            fill={numColor}
            textAnchor="middle"
            dominantBaseline="central"
            fontWeight="700"
            pointerEvents="none"
            style={{ userSelect: "none" }}
          >
            {route.number}
          </text>
        </g>
      )}

      {/* Intermediate + endpoint handles (only when selected and not actively drawing this) */}
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
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}
