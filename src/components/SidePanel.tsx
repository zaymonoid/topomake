import { useAtomValue, useSetAtom } from "jotai";
import { canAddRouteAtom, currentRouteAtom, drawingRouteIdAtom, routesAtom, selectedRouteIdAtom } from "../state/computed";
import {
  createRouteAtom,
  deleteRouteAtom,
  finishDrawingAtom,
  selectRouteAtom,
  setRouteColorAtom,
  setRouteNameAtom,
  setRouteNumberAtom,
} from "../state/actions";
import { PALETTE, RouteColor } from "../state/types";

const COLORS: RouteColor[] = ["blue", "white", "red", "yellow"];

export function SidePanel() {
  const routes = useAtomValue(routesAtom);
  const selectedId = useAtomValue(selectedRouteIdAtom);
  const drawingId = useAtomValue(drawingRouteIdAtom);
  const selected = useAtomValue(currentRouteAtom);
  const canAdd = useAtomValue(canAddRouteAtom);
  const createRoute = useSetAtom(createRouteAtom);
  const deleteRoute = useSetAtom(deleteRouteAtom);
  const selectRoute = useSetAtom(selectRouteAtom);
  const setName = useSetAtom(setRouteNameAtom);
  const setNumber = useSetAtom(setRouteNumberAtom);
  const setColor = useSetAtom(setRouteColorAtom);
  const finishDrawing = useSetAtom(finishDrawingAtom);

  return (
    <aside className="sidepanel">
      <div>
        <h3>Routes</h3>
        <button className="primary" disabled={!canAdd} onClick={() => createRoute()}>
          + Add route
        </button>
        {drawingId && (
          <button style={{ marginLeft: 6 }} onClick={() => finishDrawing()}>
            Finish drawing
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {routes.length === 0 && (
          <p style={{ color: "#666", fontSize: 12 }}>No routes yet.</p>
        )}
        {routes.map((r) => (
          <div
            key={r.id}
            className={`route-row ${r.id === selectedId ? "selected" : ""}`}
            onClick={() => selectRoute(r.id)}
          >
            <span className="num" style={{ background: PALETTE[r.color], color: r.color === "white" || r.color === "yellow" ? "#000" : "#fff" }}>
              {r.number}
            </span>
            <span className="name">{r.name || <em style={{ color: "#666" }}>unnamed</em>}</span>
          </div>
        ))}
      </div>

      {selected && (
        <div className="route-editor">
          <h3 style={{ marginBottom: 0 }}>
            Route {selected.number} {drawingId === selected.id && <span style={{ color: "#888", fontWeight: 400 }}>(drawing…)</span>}
          </h3>

          <div>
            <label>Name</label>
            <input
              type="text"
              value={selected.name}
              onChange={(e) => setName({ id: selected.id, name: e.target.value })}
              placeholder="e.g. Whip-poor-will"
            />
          </div>

          <div>
            <label>Number</label>
            <input
              type="number"
              value={selected.number}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n)) setNumber({ id: selected.id, number: n });
              }}
            />
          </div>

          <div>
            <label>Color</label>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${selected.color === c ? "selected" : ""}`}
                  style={{ background: PALETTE[c], padding: 0 }}
                  onClick={() => setColor({ id: selected.id, color: c })}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <button onClick={() => deleteRoute(selected.id)} style={{ marginTop: 4 }}>
            Delete route
          </button>
        </div>
      )}
    </aside>
  );
}
