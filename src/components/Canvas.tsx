import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { topoAtom, currentToolAtom } from "../state/atoms";
import {
  annotationsAtom,
  canvasCursorAtom,
  drawingRouteIdAtom,
  routesAtom,
} from "../state/computed";
import { appendPointAtom, createAnnotationAtom } from "../state/actions";
import { Point } from "../state/types";
import { RouteShape } from "./RouteShape";
import { AnnotationPin } from "./AnnotationPin";

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
  const routes = useAtomValue(routesAtom);
  const annotations = useAtomValue(annotationsAtom);
  const drawingId = useAtomValue(drawingRouteIdAtom);
  const cursor = useAtomValue(canvasCursorAtom);
  const tool = useAtomValue(currentToolAtom);
  const appendPoint = useSetAtom(appendPointAtom);
  const createAnnotation = useSetAtom(createAnnotationAtom);
  const setTool = useSetAtom(currentToolAtom);
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  if (!topo.imageDataUrl) {
    return (
      <main className="canvas">
        <div className="canvas-inner">
          <div className="canvas-empty">
            <p>No image loaded.</p>
            <p className="hint">Upload one from the top bar to begin.</p>
          </div>
        </div>
      </main>
    );
  }

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const np = clientToNormalized(e, svgRef.current, topo.imageWidth, topo.imageHeight);
    if (drawingId) {
      appendPoint(np);
      return;
    }
    if (tool === "annotate") {
      createAnnotation({ x: np.x, y: np.y });
      setTool("select");
    }
  };

  const annotateCursor = tool === "annotate" && !drawingId ? "crosshair" : cursor;

  return (
    <main className="canvas">
      <div className="canvas-inner">
        <div ref={stageRef} className="stage">
          <img className="photo" src={topo.imageDataUrl} alt="" draggable={false} />
          <svg
            ref={svgRef}
            className="overlay-svg"
            viewBox={`0 0 ${topo.imageWidth} ${topo.imageHeight}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ cursor: annotateCursor }}
            onClick={onCanvasClick}
          >
            {routes.map((route) => (
              <RouteShape
                key={route.id}
                route={route}
                imageWidth={topo.imageWidth}
                imageHeight={topo.imageHeight}
                svgRef={svgRef}
              />
            ))}
          </svg>

          {annotations.map((a) => (
            <AnnotationPin key={a.id} annotation={a} stageRef={stageRef} />
          ))}
        </div>
      </div>
    </main>
  );
}
