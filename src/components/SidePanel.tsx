import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { topoAtom, currentToolAtom, selectedAnnotationIdAtom } from "../state/atoms";
import {
  annotationsAtom,
  annotationCountAtom,
  canAddRouteAtom,
  currentRouteAtom,
  drawingRouteIdAtom,
  routeCountAtom,
  routeNumberRangeAtom,
  routesAtom,
  selectedRouteIdAtom,
} from "../state/computed";
import {
  createRouteAtom,
  deleteAnnotationAtom,
  deleteRouteAtom,
  selectRouteAtom,
  setNumberingOrderAtom,
  setRouteColorAtom,
  setRouteFinishStyleAtom,
  setRouteNameAtom,
  setStartNumberAtom,
} from "../state/actions";
import { NumberingOrder, PALETTE, RouteColor, RouteFinishStyle } from "../state/types";
import { SHORTCUTS } from "../input/shortcuts";

const COLORS: RouteColor[] = ["white", "blue", "red", "yellow"];

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="8" cy="13" r="1.4" />
    </svg>
  );
}

export function SidePanel() {
  const topo = useAtomValue(topoAtom);
  const routes = useAtomValue(routesAtom);
  const routeCount = useAtomValue(routeCountAtom);
  const range = useAtomValue(routeNumberRangeAtom);
  const selectedId = useAtomValue(selectedRouteIdAtom);
  const drawingId = useAtomValue(drawingRouteIdAtom);
  const selected = useAtomValue(currentRouteAtom);
  const canAdd = useAtomValue(canAddRouteAtom);
  const annotations = useAtomValue(annotationsAtom);
  const annCount = useAtomValue(annotationCountAtom);
  const selectedAnnId = useAtomValue(selectedAnnotationIdAtom);

  const setStartNumber = useSetAtom(setStartNumberAtom);
  const setNumberingOrder = useSetAtom(setNumberingOrderAtom);
  const createRoute = useSetAtom(createRouteAtom);
  const deleteRoute = useSetAtom(deleteRouteAtom);
  const selectRoute = useSetAtom(selectRouteAtom);
  const setName = useSetAtom(setRouteNameAtom);
  const setColor = useSetAtom(setRouteColorAtom);
  const setFinishStyle = useSetAtom(setRouteFinishStyleAtom);
  const setTool = useSetAtom(currentToolAtom);
  const setSelectedAnnId = useSetAtom(selectedAnnotationIdAtom);
  const deleteAnnotation = useSetAtom(deleteAnnotationAtom);

  const nameRef = useRef<HTMLInputElement>(null);

  const rangeLabel =
    range === null
      ? "no routes yet"
      : range.min === range.max
        ? `label: ${range.min}`
        : `labels: ${range.min} → ${range.max}`;

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
            <button onClick={() => setStartNumber(Math.max(1, topo.startNumber - 1))}>−</button>
            <input
              value={topo.startNumber}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n)) setStartNumber(n);
              }}
            />
            <button onClick={() => setStartNumber(topo.startNumber + 1)}>+</button>
          </div>
        </div>
        <div className="numbering">
          <div className="lbl">Order</div>
          <div className="select-wrap">
            <select
              className="ts-select"
              value={topo.numberingOrder}
              onChange={(e) => setNumberingOrder(e.target.value as NumberingOrder)}
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

      {/* Routes */}
      <div className="routes-wrap">
        <div className="panel-section" style={{ paddingBottom: 8 }}>
          <div className="panel-h">
            <span className="title">Routes</span>
            <div className="panel-h-actions">
              <span className="count">{routeCount}</span>
              <button
                className="hdr-add"
                disabled={!canAdd}
                onClick={() => createRoute()}
              >
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                  <path d="M7 3 V11 M3 7 H11" />
                </svg>
                <span className="tip">New route<kbd>{SHORTCUTS.draw.label}</kbd></span>
              </button>
            </div>
          </div>
        </div>

        <div className="routes">
          {routes.length === 0 && <div className="routes-empty">No routes yet.</div>}
          {routes.map((r) => {
            const variation = r.branchFrom !== undefined;
            return (
              <div
                key={r.id}
                className={`route-row ${r.id === selectedId ? "selected" : ""} ${variation ? "variation" : ""}`}
                onClick={() => selectRoute(r.id)}
              >
                {variation ? (
                  <span className="var-chip" title="Variation">↳</span>
                ) : (
                  <span className="num-chip">{r.number}</span>
                )}
                <span
                  className="swatch"
                  style={{ background: PALETTE[r.color] }}
                />
                <span className="route-name">
                  {r.name || (
                    <span className="placeholder">
                      {variation ? "unnamed variation" : "unnamed route"}
                    </span>
                  )}
                </span>
                <span className="route-meta">{r.points.length} pts</span>
                <button
                  className={`row-action ${r.id === selectedId ? "always" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRoute(r.id);
                  }}
                  title="Delete route"
                >
                  <MoreIcon />
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
              className="hdr-add"
              onClick={() => setTool("annotate")}
            >
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <path d="M7 3 V11 M3 7 H11" />
              </svg>
              <span className="tip">Annotate<kbd>{SHORTCUTS.annotate.label}</kbd></span>
            </button>
          </div>
        </div>
        {annotations.length === 0 ? (
          <div className="ann-list-empty">No annotations. Press {SHORTCUTS.annotate.label} then click the photo.</div>
        ) : (
          <div className="ann-list">
            {annotations.map((a) => (
              <div
                key={a.id}
                className={`ann-item ${a.id === selectedAnnId ? "selected" : ""}`}
                onClick={() => setSelectedAnnId(a.id)}
              >
                <span className="ann-bullet" />
                <span className="ann-text">
                  {a.text || <span className="placeholder">empty annotation</span>}
                </span>
                <button
                  className="row-action always"
                  title="Delete annotation"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAnnotation(a.id);
                  }}
                >
                  <MoreIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspector */}
      {selected && (
        <div className="inspector">
          <div className="inspector-h">
            {selected.branchFrom !== undefined ? (
              <span className="var-chip" title="Variation">↳</span>
            ) : (
              <span className="num-chip">{selected.number}</span>
            )}
            <input
              ref={nameRef}
              className="name-edit"
              value={selected.name}
              onChange={(e) => setName({ id: selected.id, name: e.target.value })}
              placeholder={selected.branchFrom !== undefined ? "unnamed variation" : "unnamed route"}
            />
            <button
              className="icon-btn"
              style={{ width: 24, height: 24 }}
              title="Rename"
              onClick={() => nameRef.current?.focus()}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <path d="M11 3 L13 5 L7 11 L4 12 L5 9 Z" />
              </svg>
            </button>
            <button
              className="icon-btn icon-btn-danger"
              style={{ width: 24, height: 24 }}
              title="Delete route"
              onClick={() => deleteRoute(selected.id)}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4 H13 M6 4 V2.5 H10 V4 M4.5 4 V13 H11.5 V4 M7 6.5 V11 M9 6.5 V11" />
              </svg>
            </button>
          </div>

          <div className="inspector-row">
            <span>Points</span>
            <div className="points-readout">
              <span className="v">{selected.points.length}</span>
              {selected.points.length > 0 && (
                <span className="bar">
                  {selected.points.map((_, i) => (
                    <span
                      key={i}
                      className={
                        i === 0 ? "s" : i === selected.points.length - 1 ? "e" : undefined
                      }
                    />
                  ))}
                </span>
              )}
            </div>
          </div>

          <div className="inspector-row">
            <span>Color</span>
            <div className="color-cell">
              <div className="color-swatches">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`color-swatch ${selected.color === c ? "selected" : ""}`}
                    style={{ background: PALETTE[c] }}
                    onClick={() => setColor({ id: selected.id, color: c })}
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
                  setFinishStyle({
                    id: selected.id,
                    finishStyle: e.target.value as RouteFinishStyle,
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
