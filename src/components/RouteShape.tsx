import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import {
  beginDragAtom,
  branchRouteAtom,
  deletePointAtom,
  endDragAtom,
  insertPointAtom,
  selectRouteAtom,
  setDragPointAtom,
} from "../state/actions";
import { currentToolAtom, hoveredHandleAtom, topoAtom } from "../state/atoms";
import {
  dragOverrideForRouteAtomFamily,
  drawingRouteIdAtom,
  routeAtomFamily,
  selectedRouteIdAtom,
} from "../state/computed";
import { PALETTE, type Point, type Route } from "../state/types";
import { catmullRomPath } from "../util/spline";

type Props = {
  route: Route;
  imageWidth: number;
  imageHeight: number;
  svgRef: React.RefObject<SVGSVGElement>;
};

function clientToNormalized(
  e: { clientX: number; clientY: number },
  rect: DOMRect,
  w: number,
  h: number,
): Point {
  const scale = Math.min(rect.width / w, rect.height / h);
  const renderedW = w * scale;
  const renderedH = h * scale;
  const offsetX = (rect.width - renderedW) / 2;
  const offsetY = (rect.height - renderedH) / 2;
  const px = (e.clientX - rect.left - offsetX) / scale;
  const py = (e.clientY - rect.top - offsetY) / scale;
  return { x: px / w, y: py / h };
}

const NO_PARENT = "__no_parent__";

export function RouteShape({ route, imageWidth, imageHeight, svgRef }: Props) {
  const selectedId = useAtomValue(selectedRouteIdAtom);
  const drawingId = useAtomValue(drawingRouteIdAtom);
  const tool = useAtomValue(currentToolAtom);
  const topo = useAtomValue(topoAtom);
  const dragOverride = useAtomValue(dragOverrideForRouteAtomFamily(route.id));
  // Variations subscribe to their parent so the anchor follows the parent's data
  // (and the parent's drag overrides) without re-rendering every other route.
  const parentRoute = useAtomValue(routeAtomFamily(route.branchFrom?.routeId ?? NO_PARENT));
  const parentDragOverride = useAtomValue(
    dragOverrideForRouteAtomFamily(route.branchFrom?.routeId ?? NO_PARENT),
  );
  const hoveredHandle = useAtomValue(hoveredHandleAtom);
  const setHoveredHandle = useSetAtom(hoveredHandleAtom);
  const selectRoute = useSetAtom(selectRouteAtom);
  const beginDrag = useSetAtom(beginDragAtom);
  const setDragPoint = useSetAtom(setDragPointAtom);
  const endDrag = useSetAtom(endDragAtom);
  const insertPoint = useSetAtom(insertPointAtom);
  const deletePoint = useSetAtom(deletePointAtom);
  const branchRoute = useSetAtom(branchRouteAtom);

  const isSelected = selectedId === route.id;
  const isDrawing = drawingId === route.id;
  const isVariation = route.branchFrom !== undefined;
  const isAnyDrawing = drawingId !== null;
  const branchToolActive = tool === "branch" && !isAnyDrawing;
  const startColor = PALETTE[route.color];
  const numColor = route.color === "white" || route.color === "yellow" ? "#000" : "#fff";

  const dragPointerIdRef = useRef<number | null>(null);
  // Cached on pointerdown so per-frame moves don't force a layout flush.
  const dragRectRef = useRef<DOMRect | null>(null);

  // The variation's anchor in normalized coords, taking the parent's live drag
  // override into account when the parent's anchor node is being dragged.
  let anchor: Point | null = null;
  if (route.branchFrom && parentRoute) {
    const at = route.branchFrom.atIndex;
    if (parentDragOverride && parentDragOverride.pointIndex === at) {
      anchor = parentDragOverride.point;
    } else {
      anchor = parentRoute.points[at] ?? null;
    }
  }

  // Own (divergent) points in pixel coords, with this route's drag override applied.
  const ownPixelPoints = route.points.map((p, i) => {
    const src = dragOverride && i === dragOverride.pointIndex ? dragOverride.point : p;
    return { x: src.x * imageWidth, y: src.y * imageHeight };
  });
  // Full pixel polyline: anchor prepended for variations so the connecting segment renders.
  const pixelPoints =
    anchor !== null
      ? [{ x: anchor.x * imageWidth, y: anchor.y * imageHeight }, ...ownPixelPoints]
      : ownPixelPoints;

  const pathD = catmullRomPath(pixelPoints);
  const startChipPoint = !isVariation ? pixelPoints[0] : null;
  const end = pixelPoints[pixelPoints.length - 1];

  const baseSize = Math.min(imageWidth, imageHeight);
  const lineWidth = baseSize * 0.0025 * topo.lineWidth;
  const glowWidth = baseSize * 0.014;
  const selectedLineWidth = baseSize * 0.0035 * topo.lineWidth;
  const startR = baseSize * 0.011 * topo.numberSize;
  const startFontSize = baseSize * 0.013 * topo.numberSize;
  const endR = baseSize * 0.005;
  const handleR = baseSize * 0.013;
  const handleMidR = baseSize * 0.011;
  const handleStroke = baseSize * 0.003;
  const labelRingR = baseSize * 0.04;
  const labelRingStroke = baseSize * 0.004;
  const labelRingDash = baseSize * 0.007;
  const selectedDash = baseSize * 0.012;
  const selectedGap = baseSize * 0.008;
  const hitWidth = baseSize * 0.012;
  const tooltipFontSize = baseSize * 0.014;
  const tooltipPadX = baseSize * 0.009;
  const tooltipPadY = baseSize * 0.006;
  const tooltipOffset = baseSize * 0.028;

  const onLineClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (branchToolActive) return; // branch tool only acts on handle clicks
    if (!isSelected) {
      selectRoute(route.id);
      return;
    }
    if (isDrawing || !svgRef.current) return;
    const np = clientToNormalized(
      e,
      svgRef.current.getBoundingClientRect(),
      imageWidth,
      imageHeight,
    );
    const clickPx = { x: np.x * imageWidth, y: np.y * imageHeight };
    let bestSegIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pixelPoints.length - 1; i++) {
      const d = pointSegmentDistance(clickPx, pixelPoints[i], pixelPoints[i + 1]);
      if (d < bestDist) {
        bestDist = d;
        bestSegIdx = i;
      }
    }
    // pixelPoints includes the prepended anchor for variations, so the mapping
    // from segment index to own-points insert index differs:
    //   non-variation: segment i is between own[i] and own[i+1] -> insert at i+1
    //   variation:     segment 0 is anchor->own[0], segment i is between own[i-1] and own[i] -> insert at i
    const insertIdx = isVariation ? bestSegIdx : bestSegIdx + 1;
    insertPoint({ routeId: route.id, index: insertIdx, point: np });
  };

  const onHandleDown = (e: React.PointerEvent, ownIndex: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (branchToolActive) return; // branch tool uses onClick instead
    if (!svgRef.current) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragPointerIdRef.current = e.pointerId;
    dragRectRef.current = svgRef.current.getBoundingClientRect();
    beginDrag({ routeId: route.id, pointIndex: ownIndex });
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

  const onHandleContextMenu = (e: React.MouseEvent, ownIndex: number) => {
    if (isDrawing) return;
    if (route.points.length <= 2) return;
    e.preventDefault();
    e.stopPropagation();
    deletePoint({ routeId: route.id, index: ownIndex });
  };

  // Anchor handle (variations only): dragging this drags the PARENT's point at
  // branchFrom.atIndex. The variation's rendered anchor follows automatically
  // because parentDragOverride is read above.
  const onAnchorHandleDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (branchToolActive) return;
    if (!svgRef.current) return;
    if (!route.branchFrom) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragPointerIdRef.current = e.pointerId;
    dragRectRef.current = svgRef.current.getBoundingClientRect();
    beginDrag({ routeId: route.branchFrom.routeId, pointIndex: route.branchFrom.atIndex });
  };

  const onBranchHandleClick = (e: React.MouseEvent, ownIndex: number) => {
    e.stopPropagation();
    branchRoute({ parentRouteId: route.id, atIndex: ownIndex });
  };

  const onBranchHandleEnter = (ownIndex: number) => {
    setHoveredHandle({ routeId: route.id, index: ownIndex });
  };

  const onBranchHandleLeave = (ownIndex: number) => {
    const h = hoveredHandle;
    if (h && h.routeId === route.id && h.index === ownIndex) {
      setHoveredHandle(null);
    }
  };

  // Show handles when the route is selected OR the branch tool is offering them.
  const showHandles = isSelected || branchToolActive;
  const hoveredOnThis =
    branchToolActive && hoveredHandle && hoveredHandle.routeId === route.id
      ? hoveredHandle.index
      : null;
  const hoveredPx = hoveredOnThis !== null ? (ownPixelPoints[hoveredOnThis] ?? null) : null;
  const tooltipText = "Add variation";
  const tooltipTextWidth = tooltipText.length * tooltipFontSize * 0.6;
  const tooltipBoxW = tooltipTextWidth + tooltipPadX * 2;
  const tooltipBoxH = tooltipFontSize + tooltipPadY * 2;

  return (
    <g>
      {/* Wide invisible hit target — disabled in branch mode so it doesn't
          shield the handles below from pointer events. */}
      {pathD && (
        // biome-ignore lint/a11y/noStaticElementInteractions: SVG hit path for route selection
        <path
          d={pathD}
          stroke="transparent"
          strokeWidth={hitWidth}
          fill="none"
          pointerEvents={branchToolActive ? "none" : "auto"}
          style={{
            cursor: isSelected ? (isDrawing ? "default" : "copy") : "pointer",
          }}
          onClick={onLineClick}
        />
      )}

      {/* Selection glow underneath */}
      {isSelected && pathD && <path className="selected-glow" d={pathD} strokeWidth={glowWidth} />}

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
        <circle cx={end.x} cy={end.y} r={endR} fill="#fff" pointerEvents="none" />
      )}
      {end &&
        pixelPoints.length >= 2 &&
        route.finishStyle === "arrow" &&
        (() => {
          const prev = pixelPoints[pixelPoints.length - 2];
          const dx = end.x - prev.x;
          const dy = end.y - prev.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const size = baseSize * 0.016;
          const tipX = end.x;
          const tipY = end.y;
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

      {/* Anchor handle for a selected variation — drags the PARENT's anchor
          point. Rendered only when selected (not in branch-tool mode) so it
          doesn't compete with the parent's branch-tool handles. */}
      {isSelected &&
        !branchToolActive &&
        isVariation &&
        anchor &&
        route.branchFrom &&
        (() => {
          const ax = anchor.x * imageWidth;
          const ay = anchor.y * imageHeight;
          return (
            <g>
              <circle
                cx={ax}
                cy={ay}
                r={handleMidR * 1.2}
                fill="transparent"
                pointerEvents="all"
                style={{ cursor: "grab" }}
                onPointerDown={onAnchorHandleDown}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
              />
              <circle
                className="handle-mid"
                cx={ax}
                cy={ay}
                r={handleMidR}
                strokeWidth={handleStroke}
                onPointerDown={onAnchorHandleDown}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
              />
            </g>
          );
        })()}

      {/* Handles (own divergent points only — anchor belongs to parent). */}
      {showHandles &&
        ownPixelPoints.map((p, i) => {
          const isFirst = i === 0;
          const isLast = i === ownPixelPoints.length - 1;
          // Treat first/last as "endpoint" handles for non-variations; for variations,
          // the "start" is the parent's anchor so even own[0] is a mid-style handle.
          const useEndpointStyle = !isVariation && (isFirst || isLast);
          const cls = branchToolActive
            ? "handle-mid handle-branch"
            : useEndpointStyle
              ? isFirst
                ? "handle-start"
                : "handle-end"
              : "handle-mid";
          const r = useEndpointStyle ? handleR : handleMidR;
          // Keep the invisible hit area just slightly beyond the visible circle
          // so clicks on the line between handles still reach the line, not the
          // handle hit zone.
          const hitR = useEndpointStyle ? handleR * 1.2 : handleMidR * 1.2;
          const branchHandlers = branchToolActive
            ? {
                onClick: (e: React.MouseEvent) => onBranchHandleClick(e, i),
                onPointerEnter: () => onBranchHandleEnter(i),
                onPointerLeave: () => onBranchHandleLeave(i),
              }
            : {};
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: index is the stable identity of a polyline vertex
            <g key={i}>
              {/* Invisible larger hit zone — gives a clear "slightly beyond
                  visual" pointer target without enlarging the rendered circle. */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: SVG hit target for pointer drag */}
              <circle
                cx={p.x}
                cy={p.y}
                r={hitR}
                fill="transparent"
                pointerEvents="all"
                style={branchToolActive ? { cursor: "copy" } : { cursor: "grab" }}
                onPointerDown={(e) => onHandleDown(e, i)}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                onContextMenu={(e) => onHandleContextMenu(e, i)}
                {...branchHandlers}
              />
              {/* biome-ignore lint/a11y/noStaticElementInteractions: SVG drag handle */}
              <circle
                className={cls}
                cx={p.x}
                cy={p.y}
                r={r}
                strokeWidth={handleStroke}
                style={branchToolActive ? { cursor: "copy" } : undefined}
                onPointerDown={(e) => onHandleDown(e, i)}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                onContextMenu={(e) => onHandleContextMenu(e, i)}
                {...branchHandlers}
              />
            </g>
          );
        })}

      {/* Dashed label ring around start chip when selected — non-variations only. */}
      {isSelected && startChipPoint && (
        <circle
          className="label-ring"
          cx={startChipPoint.x}
          cy={startChipPoint.y}
          r={labelRingR}
          strokeWidth={labelRingStroke}
          strokeDasharray={`${labelRingDash} ${labelRingDash}`}
          pointerEvents="none"
        />
      )}

      {/* Start chip with number — rendered last so the number stays readable above
          any handles drawn at the same position. Non-interactive when handles are
          shown so clicks fall through to the handle below. */}
      {startChipPoint && (
        // biome-ignore lint/a11y/noStaticElementInteractions: SVG start chip pointer target
        <g
          style={{ cursor: showHandles ? "default" : "pointer" }}
          pointerEvents={showHandles ? "none" : "auto"}
          onClick={
            showHandles
              ? undefined
              : (e) => {
                  e.stopPropagation();
                  selectRoute(route.id);
                }
          }
        >
          <circle cx={startChipPoint.x} cy={startChipPoint.y} r={startR} fill={startColor} />
          <text
            x={startChipPoint.x}
            y={startChipPoint.y}
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

      {/* Branch-tool tooltip */}
      {hoveredPx && (
        <g pointerEvents="none">
          <rect
            className="branch-tip-box"
            x={hoveredPx.x - tooltipBoxW / 2}
            y={hoveredPx.y - tooltipOffset - tooltipBoxH}
            width={tooltipBoxW}
            height={tooltipBoxH}
            rx={tooltipBoxH * 0.2}
            ry={tooltipBoxH * 0.2}
          />
          <text
            className="branch-tip-text"
            x={hoveredPx.x}
            y={hoveredPx.y - tooltipOffset - tooltipBoxH / 2}
            fontSize={tooltipFontSize}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Inter', sans-serif"
          >
            {tooltipText}
          </text>
        </g>
      )}
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
