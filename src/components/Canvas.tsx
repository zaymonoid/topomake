import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
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
  const image = topo.image;
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
  const innerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number } | null>(null);

  const imageWidth = image?.width ?? 0;
  const imageHeight = image?.height ?? 0;

  useEffect(() => {
    const el = innerRef.current;
    if (!el || !imageWidth || !imageHeight) return;
    const fit = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scale = Math.min(rect.width / imageWidth, rect.height / imageHeight);
      setStageSize({ w: imageWidth * scale, h: imageHeight * scale });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [imageWidth, imageHeight]);

  if (!image) {
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
    const np = clientToNormalized(e, svgRef.current, image.width, image.height);
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
      <div ref={innerRef} className="canvas-inner">
        <div
          ref={stageRef}
          className="stage"
          style={stageSize ? { width: stageSize.w, height: stageSize.h } : { visibility: "hidden" }}
        >
          <img className="photo" src={image.dataUrl} alt="" draggable={false} />
          <svg
            ref={svgRef}
            className="overlay-svg"
            viewBox={`0 0 ${image.width} ${image.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ cursor: annotateCursor }}
            onClick={onCanvasClick}
          >
            {routes.map((route) => (
              <RouteShape
                key={route.id}
                route={route}
                imageWidth={image.width}
                imageHeight={image.height}
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
