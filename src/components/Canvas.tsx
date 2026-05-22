import { useSelector } from "@zaymonoid/katha/react";
import { useEffect, useRef, useState } from "react";
import {
  selectAnnotations,
  selectCanvasCursor,
  selectCurrentTool,
  selectDrawingRouteId,
  selectImage,
  selectRoutes,
} from "../state/selectors";
import { store } from "../state/store";
import type { Point } from "../state/types";
import { uid } from "../util/id";
import { readImageFile } from "../util/image";
import { AnnotationPin } from "./AnnotationPin";
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
  const image = useSelector(store, selectImage);
  const routes = useSelector(store, selectRoutes);
  const annotations = useSelector(store, selectAnnotations);
  const drawingId = useSelector(store, selectDrawingRouteId);
  const cursor = useSelector(store, selectCanvasCursor);
  const tool = useSelector(store, selectCurrentTool);
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Load a dropped or picked file. When an image is already present, the user
  // must confirm replacement — matches the TopBar upload flow.
  const loadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please drop an image file.");
      return;
    }
    if (image && routes.length > 0) {
      const ok = confirm("Replacing the image will keep existing routes. Continue?");
      if (!ok) return;
    }
    try {
      const data = await readImageFile(file);
      store.put({ id: "topo/setImage", data });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void loadFile(file);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragOver) setIsDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear when the drag leaves the inner element entirely (not on child enter).
    if (e.currentTarget === e.target) setIsDragOver(false);
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  const imageWidth = image?.width ?? 0;
  const imageHeight = image?.height ?? 0;

  // Clear the branch-tool tooltip target whenever the user leaves the branch tool
  // or enters drawing mode, so a stale tooltip never lingers.
  useEffect(() => {
    if (tool !== "branch" || drawingId !== null) {
      store.put({ id: "hover/clear" });
    }
  }, [tool, drawingId]);

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
        {/* biome-ignore lint/a11y/noStaticElementInteractions: drop target for file uploads */}
        <div
          ref={innerRef}
          className="canvas-inner"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className={`canvas-dropzone ${isDragOver ? "is-drag-over" : ""}`}>
            <div className="dz-icon" aria-hidden="true">
              <svg
                viewBox="0 0 48 48"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 30 A8 8 0 1 1 22 18 A10 10 0 0 1 41 22 A7 7 0 0 1 38 35" />
                <path d="M24 38 V22 M18 28 L24 22 L30 28" />
              </svg>
            </div>
            <div className="dz-title">Drop an image to start</div>
            <div className="dz-sub">or</div>
            <button
              type="button"
              className="upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose a file
            </button>
            <div className="dz-formats">PNG · JPG</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onFileInputChange}
          />
        </div>
      </main>
    );
  }

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const np = clientToNormalized(e, svgRef.current, image.width, image.height);
    if (drawingId) {
      store.put({ id: "points/append", data: { routeId: drawingId, point: np } });
      return;
    }
    if (tool === "annotate") {
      const id = uid();
      store.put({ id: "annotations/create", data: { id, x: np.x, y: np.y } });
      store.put({ id: "mode/selectAnnotation", data: { id } });
      store.put({ id: "tool/set", data: "select" });
    }
  };

  const customCursor =
    tool === "annotate" && !drawingId
      ? "crosshair"
      : tool === "branch" && !drawingId
        ? "copy"
        : cursor;

  return (
    <main className="canvas">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drop target for file uploads */}
      <div
        ref={innerRef}
        className={`canvas-inner ${isDragOver ? "is-drag-over" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div
          ref={stageRef}
          className="stage"
          style={stageSize ? { width: stageSize.w, height: stageSize.h } : { visibility: "hidden" }}
        >
          <img className="photo" src={image.dataUrl} alt="" draggable={false} />
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: drawing surface accepts pointer input only */}
          <svg
            ref={svgRef}
            className="overlay-svg"
            viewBox={`0 0 ${image.width} ${image.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ cursor: customCursor }}
            onClick={onCanvasClick}
            aria-label="Topo drawing surface"
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
