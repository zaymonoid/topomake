import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { topoAtom, drawingRouteIdAtom } from "../state/atoms";
import { appendDrawingPointAtom } from "../state/actions";
import { Point } from "../state/types";
import { RouteShape } from "./RouteShape";

function clientToNormalized(e: React.MouseEvent, svg: SVGSVGElement, w: number, h: number): Point {
  const rect = svg.getBoundingClientRect();
  const scale = Math.min(rect.width / w, rect.height / h);
  const renderedW = w * scale;
  const renderedH = h * scale;
  const offsetX = (rect.width - renderedW) / 2;
  const offsetY = (rect.height - renderedH) / 2;
  const px = (e.clientX - rect.left - offsetX) / scale;
  const py = (e.clientY - rect.top - offsetY) / scale;
  return {
    x: Math.max(0, Math.min(1, px / w)),
    y: Math.max(0, Math.min(1, py / h)),
  };
}

export function Canvas() {
  const topo = useAtomValue(topoAtom);
  const drawingId = useAtomValue(drawingRouteIdAtom);
  const appendPoint = useSetAtom(appendDrawingPointAtom);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!topo.imageDataUrl) {
    return (
      <div className="canvas-wrap">
        <div className="canvas-empty">
          <p>No image loaded.</p>
          <p style={{ fontSize: 12 }}>Upload one from the top bar to begin.</p>
        </div>
      </div>
    );
  }

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    if (!drawingId) return; // Don't deselect on empty-canvas click — use Escape for that.
    const p = clientToNormalized(e, svgRef.current, topo.imageWidth, topo.imageHeight);
    appendPoint(p);
  };

  return (
    <div className="canvas-wrap">
      <div className="canvas-stage" style={{ aspectRatio: `${topo.imageWidth} / ${topo.imageHeight}` }}>
        <img src={topo.imageDataUrl} alt="" draggable={false} />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${topo.imageWidth} ${topo.imageHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ cursor: drawingId ? "crosshair" : "default" }}
          onClick={onCanvasClick}
        >
          {/* Crag name banner — toggleable via top bar. */}
          {topo.showBanner && (
            <g>
              <rect x={topo.imageWidth * 0.02} y={topo.imageHeight * 0.02} width={topo.imageWidth * 0.3} height={topo.imageHeight * 0.06} fill="#1e3a8a" />
              <text
                x={topo.imageWidth * 0.035}
                y={topo.imageHeight * 0.05}
                fontSize={topo.imageHeight * 0.035}
                fill="#fff"
                fontWeight="800"
                dominantBaseline="central"
                letterSpacing={topo.imageHeight * 0.001}
                style={{ userSelect: "none" }}
              >
                {topo.name.toUpperCase()}
              </text>
            </g>
          )}

          {topo.routes.map((route) => (
            <RouteShape
              key={route.id}
              route={route}
              imageWidth={topo.imageWidth}
              imageHeight={topo.imageHeight}
              svgRef={svgRef}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
