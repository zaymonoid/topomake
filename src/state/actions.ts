import { atom } from "jotai";
import {
  topoAtom,
  editorModeAtom,
  commitAtom,
  snapshotHistoryAtom,
  selectedAnnotationIdAtom,
  currentToolAtom,
  dragOverrideAtom,
} from "./atoms";
import {
  Annotation,
  NumberingOrder,
  Point,
  Route,
  RouteColor,
  RouteFinishStyle,
  Snapshot,
  Topo,
} from "./types";
import { nextRouteNumberAtom } from "./computed";

const uid = () => Math.random().toString(36).slice(2, 10);

// Reassigns `number` on each route per the chosen order.
// "created" -> unchanged. "ltr" / "rtl" -> stable sort by start.x, assign from startNumber.
// Routes without points keep their relative order at the end of the sequence.
function applyNumbering(
  routes: Route[],
  startNumber: number,
  order: NumberingOrder,
): Route[] {
  if (order === "created") return routes;
  const decorated = routes.map((r, i) => ({ r, i }));
  const withPoints = decorated.filter((d) => d.r.points.length > 0);
  const withoutPoints = decorated.filter((d) => d.r.points.length === 0);
  withPoints.sort((a, b) => {
    const dx = a.r.points[0].x - b.r.points[0].x;
    if (dx !== 0) return order === "ltr" ? dx : -dx;
    return a.i - b.i;
  });
  const ordered = [...withPoints, ...withoutPoints].map((d) => d.r);
  return ordered.map((r, i) => ({ ...r, number: startNumber + i }));
}

const numbered = (t: Topo, routes: Route[]): Route[] =>
  applyNumbering(routes, t.startNumber, t.numberingOrder);

const snapshotOf = (t: Topo): Snapshot => ({
  startNumber: t.startNumber,
  numberingOrder: t.numberingOrder,
  routes: t.routes,
  annotations: t.annotations,
});

const withRoutes = (t: Topo, routes: Route[]): Snapshot => ({
  startNumber: t.startNumber,
  numberingOrder: t.numberingOrder,
  routes,
  annotations: t.annotations,
});

const withRoutePatched = (t: Topo, id: string, patch: Partial<Route>): Snapshot =>
  withRoutes(
    t,
    t.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  );

const withAnnotationPatched = (
  t: Topo,
  id: string,
  patch: Partial<Annotation>,
): Snapshot => ({
  startNumber: t.startNumber,
  numberingOrder: t.numberingOrder,
  routes: t.routes,
  annotations: t.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
});

// === Image — setup state, not history-tracked ===

export const setImageAtom = atom(
  null,
  (get, set, payload: { dataUrl: string; width: number; height: number }) => {
    const topo = get(topoAtom);
    set(topoAtom, {
      ...topo,
      image: { dataUrl: payload.dataUrl, width: payload.width, height: payload.height },
    });
    // Transition out of "empty" once an image is loaded.
    if (get(editorModeAtom).kind === "empty") {
      set(editorModeAtom, { kind: "idle" });
    }
  },
);

// === Topo meta — name is not history-tracked (renames aren't undoable) ===

export const setTopoNameAtom = atom(null, (get, set, name: string) => {
  set(topoAtom, { ...get(topoAtom), name });
});

export const setStartNumberAtom = atom(null, (get, set, startNumber: number) => {
  const topo = get(topoAtom);
  if (topo.routes.length === 0) {
    set(commitAtom, { ...snapshotOf(topo), startNumber });
    return;
  }
  // In spatial modes, re-derive numbers from the new startNumber by position.
  // In "created" mode, shift each existing number by the same delta to preserve gaps.
  const routes =
    topo.numberingOrder === "created"
      ? (() => {
          const minNum = Math.min(...topo.routes.map((r) => r.number));
          const delta = startNumber - minNum;
          return topo.routes.map((r) => ({ ...r, number: r.number + delta }));
        })()
      : applyNumbering(topo.routes, startNumber, topo.numberingOrder);
  set(commitAtom, {
    startNumber,
    numberingOrder: topo.numberingOrder,
    routes,
    annotations: topo.annotations,
  });
});

export const setNumberingOrderAtom = atom(null, (get, set, order: NumberingOrder) => {
  const topo = get(topoAtom);
  set(commitAtom, {
    startNumber: topo.startNumber,
    numberingOrder: order,
    routes: applyNumbering(topo.routes, topo.startNumber, order),
    annotations: topo.annotations,
  });
});

// === Routes ===

export const createRouteAtom = atom(null, (get, set) => {
  const topo = get(topoAtom);
  const id = uid();
  const route: Route = {
    id,
    number: get(nextRouteNumberAtom),
    name: "",
    color: "blue",
    finishStyle: "circle",
    points: [],
  };
  set(commitAtom, withRoutes(topo, numbered(topo, [...topo.routes, route])));
  set(editorModeAtom, { kind: "drawing", routeId: id });
});

export const deleteRouteAtom = atom(null, (get, set, id: string) => {
  const topo = get(topoAtom);
  set(commitAtom, withRoutes(topo, numbered(topo, topo.routes.filter((r) => r.id !== id))));
  const mode = get(editorModeAtom);
  if (mode.kind !== "empty" && "routeId" in mode && mode.routeId === id) {
    set(editorModeAtom, { kind: "idle" });
  }
});

export const setRouteNameAtom = atom(null, (get, set, payload: { id: string; name: string }) => {
  set(commitAtom, withRoutePatched(get(topoAtom), payload.id, { name: payload.name }));
});

export const setRouteNumberAtom = atom(null, (get, set, payload: { id: string; number: number }) => {
  set(commitAtom, withRoutePatched(get(topoAtom), payload.id, { number: payload.number }));
});

export const setRouteColorAtom = atom(null, (get, set, payload: { id: string; color: RouteColor }) => {
  set(commitAtom, withRoutePatched(get(topoAtom), payload.id, { color: payload.color }));
});

export const setRouteFinishStyleAtom = atom(
  null,
  (get, set, payload: { id: string; finishStyle: RouteFinishStyle }) => {
    set(
      commitAtom,
      withRoutePatched(get(topoAtom), payload.id, { finishStyle: payload.finishStyle }),
    );
  },
);

// === Mode transitions ===

export const selectRouteAtom = atom(null, (_get, set, routeId: string) => {
  set(editorModeAtom, { kind: "selected", routeId });
});

export const deselectAtom = atom(null, (_get, set) => {
  set(editorModeAtom, { kind: "idle" });
});

export const finishDrawingAtom = atom(null, (get, set) => {
  const m = get(editorModeAtom);
  if (m.kind !== "drawing") return;
  set(currentToolAtom, "select");
  // If the route ended up with no points, drop it.
  const route = get(topoAtom).routes.find((r) => r.id === m.routeId);
  if (route && route.points.length === 0) {
    set(deleteRouteAtom, m.routeId);
    return;
  }
  set(editorModeAtom, { kind: "selected", routeId: m.routeId });
});

export const cancelDrawingAtom = atom(null, (get, set) => {
  const m = get(editorModeAtom);
  if (m.kind !== "drawing") return;
  set(currentToolAtom, "select");
  set(deleteRouteAtom, m.routeId);
});

// === Drawing — append a point while in drawing mode ===

export const appendPointAtom = atom(null, (get, set, p: Point) => {
  const m = get(editorModeAtom);
  if (m.kind !== "drawing") return;
  const topo = get(topoAtom);
  const route = topo.routes.find((r) => r.id === m.routeId);
  if (!route) return;
  // Re-number on the first point (route gains a spatial anchor). Later points don't move the start.
  const wasFirstPoint = route.points.length === 0;
  const updated = topo.routes.map((r) =>
    r.id === m.routeId ? { ...r, points: [...r.points, p] } : r,
  );
  set(commitAtom, withRoutes(topo, wasFirstPoint ? numbered(topo, updated) : updated));
});

// === Drag — target lives in the mode itself ===

export const beginDragAtom = atom(
  null,
  (_get, set, payload: { routeId: string; pointIndex: number }) => {
    set(snapshotHistoryAtom);
    set(dragOverrideAtom, null);
    set(editorModeAtom, { kind: "dragging", routeId: payload.routeId, pointIndex: payload.pointIndex });
  },
);

// Per-frame updates write only to dragOverrideAtom, keeping topoAtom stable so
// the rest of the app doesn't re-render on every pointermove.
export const setDragPointAtom = atom(null, (get, set, point: Point) => {
  const m = get(editorModeAtom);
  if (m.kind !== "dragging") return;
  set(dragOverrideAtom, { routeId: m.routeId, pointIndex: m.pointIndex, point });
});

export const endDragAtom = atom(null, (get, set) => {
  const m = get(editorModeAtom);
  if (m.kind !== "dragging") return;
  const override = get(dragOverrideAtom);
  if (override) {
    const topo = get(topoAtom);
    const updated = topo.routes.map((r) =>
      r.id === override.routeId
        ? { ...r, points: r.points.map((p, i) => (i === override.pointIndex ? override.point : p)) }
        : r,
    );
    // Re-number only when the start point moved.
    const routes = override.pointIndex === 0 ? numbered(topo, updated) : updated;
    set(topoAtom, { ...topo, routes });
    set(dragOverrideAtom, null);
  }
  set(editorModeAtom, { kind: "selected", routeId: m.routeId });
});

// === Point manipulation ===

export const insertPointAtom = atom(
  null,
  (get, set, payload: { routeId: string; index: number; point: Point }) => {
    const topo = get(topoAtom);
    const route = topo.routes.find((r) => r.id === payload.routeId);
    if (!route) return;
    const points = [...route.points];
    points.splice(payload.index, 0, payload.point);
    const updated = topo.routes.map((r) =>
      r.id === payload.routeId ? { ...r, points } : r,
    );
    // Re-number only when the start point changed (inserting at index 0).
    const routes = payload.index === 0 ? numbered(topo, updated) : updated;
    set(commitAtom, withRoutes(topo, routes));
  },
);

export const deletePointAtom = atom(
  null,
  (get, set, payload: { routeId: string; index: number }) => {
    const topo = get(topoAtom);
    const route = topo.routes.find((r) => r.id === payload.routeId);
    if (!route) return;
    const points = route.points.filter((_, i) => i !== payload.index);
    const updated = topo.routes.map((r) =>
      r.id === payload.routeId ? { ...r, points } : r,
    );
    // Re-number only when the start point changed (removing index 0).
    const routes = payload.index === 0 ? numbered(topo, updated) : updated;
    set(commitAtom, withRoutes(topo, routes));
  },
);

// === Annotations ===

export const createAnnotationAtom = atom(null, (get, set, payload: { x: number; y: number; text?: string }) => {
  const topo = get(topoAtom);
  const id = uid();
  const annotation: Annotation = {
    id,
    text: payload.text ?? "",
    x: payload.x,
    y: payload.y,
  };
  set(commitAtom, {
    startNumber: topo.startNumber,
    numberingOrder: topo.numberingOrder,
    routes: topo.routes,
    annotations: [...topo.annotations, annotation],
  });
  set(selectedAnnotationIdAtom, id);
});

export const setAnnotationTextAtom = atom(
  null,
  (get, set, payload: { id: string; text: string }) => {
    set(commitAtom, withAnnotationPatched(get(topoAtom), payload.id, { text: payload.text }));
  },
);

// Live position update used during drag — does NOT commit history (snapshot is taken at drag start).
export const setAnnotationPosAtom = atom(
  null,
  (get, set, payload: { id: string; x: number; y: number }) => {
    const topo = get(topoAtom);
    set(topoAtom, {
      ...topo,
      annotations: topo.annotations.map((a) =>
        a.id === payload.id ? { ...a, x: payload.x, y: payload.y } : a,
      ),
    });
  },
);

export const deleteAnnotationAtom = atom(null, (get, set, id: string) => {
  const topo = get(topoAtom);
  set(commitAtom, {
    startNumber: topo.startNumber,
    numberingOrder: topo.numberingOrder,
    routes: topo.routes,
    annotations: topo.annotations.filter((a) => a.id !== id),
  });
  if (get(selectedAnnotationIdAtom) === id) set(selectedAnnotationIdAtom, null);
});

export const beginAnnotationDragAtom = atom(null, (_get, set) => {
  set(snapshotHistoryAtom);
});
