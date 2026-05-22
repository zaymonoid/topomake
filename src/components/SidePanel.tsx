import { useSelector } from "@zaymonoid/katha/react";
import { useRef } from "react";
import { SHORTCUTS } from "../input/shortcuts";
import {
  selectAnnotationCount,
  selectAnnotations,
  selectCanAddRoute,
  selectCurrentRoute,
  selectDisplay,
  selectDrawingRouteId,
  selectRouteCount,
  selectRouteNumberRange,
  selectRouteNumbers,
  selectRoutes,
  selectSelectedAnnotationId,
  selectSelectedRouteId,
} from "../state/selectors";
import { store } from "../state/store";
import {
  type NumberingOrder,
  PALETTE,
  type RouteColor,
  type RouteFinishStyle,
} from "../state/types";
import { uid } from "../util/id";

const COLORS: RouteColor[] = ["white", "blue", "red", "yellow"];

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4 H13 M6 4 V2.5 H10 V4 M4.5 4 V13 H11.5 V4 M7 6.5 V11 M9 6.5 V11" />
    </svg>
  );
}

export function SidePanel() {
  const display = useSelector(store, selectDisplay);
  const routes = useSelector(store, selectRoutes);
  const routeNumbers = useSelector(store, selectRouteNumbers);
  const routeCount = useSelector(store, selectRouteCount);
  const range = useSelector(store, selectRouteNumberRange);
  const selectedId = useSelector(store, selectSelectedRouteId);
  const drawingId = useSelector(store, selectDrawingRouteId);
  const selected = useSelector(store, selectCurrentRoute);
  const canAdd = useSelector(store, selectCanAddRoute);
  const annotations = useSelector(store, selectAnnotations);
  const annCount = useSelector(store, selectAnnotationCount);
  const selectedAnnId = useSelector(store, selectSelectedAnnotationId);
  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnId) ?? null;

  const nameRef = useRef<HTMLInputElement>(null);

  const rangeLabel =
    range === null
      ? "no routes yet"
      : range.min === range.max
        ? `label: ${range.min}`
        : `labels: ${range.min} → ${range.max}`;

  const setNumberingStartOffset = (n: number) =>
    store.put({ id: "display/setNumberingOffset", data: n });
  const newRoute = () => {
    if (!canAdd) return;
    const id = uid();
    store.put({ id: "routes/create", data: { id } });
    store.put({ id: "mode/enterDrawing", data: { routeId: id } });
  };

  return (
    <aside className="panel">
      {/* Numbering */}
      <div className="panel-section">
        <div className="panel-h">
          <span className="title">Numbering</span>
        </div>
        <div className="numbering">
          <div className="lbl">
            Start at
            <small>{rangeLabel}</small>
          </div>
          <div className="stepper">
            <button
              type="button"
              onClick={() =>
                setNumberingStartOffset(Math.max(1, display.numbering.startOffset - 1))
              }
              aria-label="Decrease"
            >
              −
            </button>
            <input
              value={display.numbering.startOffset}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) setNumberingStartOffset(n);
              }}
            />
            <button
              type="button"
              onClick={() => setNumberingStartOffset(display.numbering.startOffset + 1)}
              aria-label="Increase"
            >
              +
            </button>
          </div>
        </div>
        <div className="numbering">
          <div className="lbl">Order</div>
          <div className="select-wrap">
            <select
              className="ts-select"
              value={display.numbering.order}
              onChange={(e) =>
                store.put({
                  id: "display/setNumberingOrder",
                  data: e.target.value as NumberingOrder,
                })
              }
            >
              <option value="created">Order created</option>
              <option value="ltr">Left → Right</option>
              <option value="rtl">Right → Left</option>
            </select>
            <svg
              className="select-chev"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 5 L6 8 L9 5" />
            </svg>
          </div>
        </div>
      </div>

      {/* Topo style */}
      <div className="panel-section">
        <div className="panel-h">
          <span className="title">Topo style</span>
        </div>
        <div className="slider-row">
          <div className="slider-lbl">
            Line width
            <span className="slider-val">{display.lineWidth.toFixed(2)}×</span>
          </div>
          <input
            className="ts-slider"
            type="range"
            min={0.5}
            max={2.5}
            step={0.05}
            value={display.lineWidth}
            onChange={(e) =>
              store.put({ id: "display/setLineWidth", data: parseFloat(e.target.value) })
            }
          />
        </div>
        <div className="slider-row">
          <div className="slider-lbl">
            Number size
            <span className="slider-val">{display.numberSize.toFixed(2)}×</span>
          </div>
          <input
            className="ts-slider"
            type="range"
            min={0.5}
            max={2.5}
            step={0.05}
            value={display.numberSize}
            onChange={(e) =>
              store.put({ id: "display/setNumberSize", data: parseFloat(e.target.value) })
            }
          />
        </div>
      </div>

      {/* Routes */}
      <div className="routes-wrap">
        <div className="panel-section" style={{ paddingBottom: 8 }}>
          <div className="panel-h">
            <span className="title">Routes</span>
            <div className="panel-h-actions">
              <span className="count">{routeCount}</span>
              <button
                type="button"
                className="hdr-add"
                disabled={!canAdd}
                onClick={newRoute}
                aria-label="New route"
              >
                <svg
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M7 3 V11 M3 7 H11" />
                </svg>
                <span className="tip">
                  New route<kbd>{SHORTCUTS.draw.label}</kbd>
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="routes">
          {routes.length === 0 && <div className="routes-empty">No routes yet.</div>}
          {routes.map((r) => {
            const variation = r.branchFrom !== undefined;
            return (
              // biome-ignore lint/a11y/useSemanticElements: contains a nested delete <button>, can't be a button
              <div
                key={r.id}
                className={`route-row ${r.id === selectedId ? "selected" : ""} ${variation ? "variation" : ""}`}
                onClick={() => store.put({ id: "mode/selectRoute", data: { routeId: r.id } })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    store.put({ id: "mode/selectRoute", data: { routeId: r.id } });
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {variation ? (
                  <span className="var-chip" title="Variation">
                    ↳
                  </span>
                ) : (
                  <span className="num-chip">{routeNumbers.get(r.id)}</span>
                )}
                <span className="swatch" style={{ background: PALETTE[r.color] }} />
                <span className="route-name">
                  {r.name || (
                    <span className="placeholder">
                      {variation ? "unnamed variation" : "unnamed route"}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className={`row-action ${r.id === selectedId ? "always" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    store.put({ id: "routes/delete", data: { id: r.id } });
                  }}
                  title="Delete route"
                  aria-label="Delete route"
                >
                  <TrashIcon />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Annotations */}
      <div className="panel-section">
        <div className="panel-h">
          <span className="title">Annotations</span>
          <div className="panel-h-actions">
            <span className="count">{annCount}</span>
            <button
              type="button"
              className="hdr-add"
              onClick={() => store.put({ id: "tool/set", data: "annotate" })}
              aria-label="Annotate"
            >
              <svg
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M7 3 V11 M3 7 H11" />
              </svg>
              <span className="tip">
                Annotate<kbd>{SHORTCUTS.annotate.label}</kbd>
              </span>
            </button>
          </div>
        </div>
        {annotations.length === 0 ? (
          <div className="ann-list-empty">
            No annotations. Press {SHORTCUTS.annotate.label} then click the photo.
          </div>
        ) : (
          <div className="ann-list">
            {annotations.map((a) => (
              // biome-ignore lint/a11y/useSemanticElements: contains a nested delete <button>, can't be a button
              <div
                key={a.id}
                className={`ann-item ${a.id === selectedAnnId ? "selected" : ""}`}
                onClick={() => store.put({ id: "mode/selectAnnotation", data: { id: a.id } })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    store.put({ id: "mode/selectAnnotation", data: { id: a.id } });
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span className="ann-bullet" />
                <span className="ann-text">
                  {a.text || <span className="placeholder">empty annotation</span>}
                </span>
                <button
                  type="button"
                  className="row-action always"
                  title="Delete annotation"
                  aria-label="Delete annotation"
                  onClick={(e) => {
                    e.stopPropagation();
                    store.put({ id: "annotations/delete", data: { id: a.id } });
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Annotation inspector */}
      {!selected && selectedAnnotation && (
        <div className="inspector">
          <div className="inspector-h">
            <span
              className="ann-color-dot"
              style={{ background: PALETTE[selectedAnnotation.color ?? "white"] }}
            />
            <span className="ann-inspector-label">Annotation</span>
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              style={{ width: 24, height: 24, marginLeft: "auto" }}
              title="Delete annotation"
              aria-label="Delete annotation"
              onClick={() =>
                store.put({ id: "annotations/delete", data: { id: selectedAnnotation.id } })
              }
            >
              <TrashIcon />
            </button>
          </div>
          <div className="inspector-row">
            <span>Color</span>
            <div className="color-cell">
              <div className="color-swatches">
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`color-swatch ${(selectedAnnotation.color ?? "white") === c ? "selected" : ""}`}
                    style={{ background: PALETTE[c] }}
                    onClick={() =>
                      store.put({
                        id: "annotations/setColor",
                        data: { id: selectedAnnotation.id, color: c },
                      })
                    }
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspector */}
      {selected && (
        <div className="inspector">
          <div className="inspector-h">
            {selected.branchFrom !== undefined ? (
              <span className="var-chip" title="Variation">
                ↳
              </span>
            ) : (
              <span className="num-chip">{routeNumbers.get(selected.id)}</span>
            )}
            <input
              ref={nameRef}
              className="name-edit"
              value={selected.name}
              onChange={(e) =>
                store.put({
                  id: "routes/setName",
                  data: { id: selected.id, name: e.target.value },
                })
              }
              placeholder={
                selected.branchFrom !== undefined ? "unnamed variation" : "unnamed route"
              }
            />
            <button
              type="button"
              className="icon-btn"
              style={{ width: 24, height: 24 }}
              title="Rename"
              aria-label="Rename"
              onClick={() => nameRef.current?.focus()}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M11 3 L13 5 L7 11 L4 12 L5 9 Z" />
              </svg>
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              style={{ width: 24, height: 24 }}
              title="Delete route"
              aria-label="Delete route"
              onClick={() => store.put({ id: "routes/delete", data: { id: selected.id } })}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 4 H13 M6 4 V2.5 H10 V4 M4.5 4 V13 H11.5 V4 M7 6.5 V11 M9 6.5 V11" />
              </svg>
            </button>
          </div>

          <div className="inspector-row">
            <span>Color</span>
            <div className="color-cell">
              <div className="color-swatches">
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`color-swatch ${selected.color === c ? "selected" : ""}`}
                    style={{ background: PALETTE[c] }}
                    onClick={() =>
                      store.put({
                        id: "routes/setColor",
                        data: { id: selected.id, color: c },
                      })
                    }
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="inspector-row">
            <span>Finish</span>
            <div className="select-wrap">
              <select
                className="ts-select"
                value={selected.finishStyle}
                onChange={(e) =>
                  store.put({
                    id: "routes/setFinishStyle",
                    data: {
                      id: selected.id,
                      finishStyle: e.target.value as RouteFinishStyle,
                    },
                  })
                }
              >
                <option value="circle">Anchor circle</option>
                <option value="arrow">Arrow</option>
              </select>
              <svg
                className="select-chev"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 5 L6 8 L9 5" />
              </svg>
            </div>
          </div>

          {drawingId === selected.id && (
            <div className="inspector-row">
              <span>Status</span>
              <span className="v">drawing… Enter to finish</span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
