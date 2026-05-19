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
import { Annotation, Point, Route, RouteColor, Topo } from "./types";
import { nextRouteNumberAtom } from "./computed";

const uid = () => Math.random().toString(36).slice(2, 10);

// === Image ===

export const setImageAtom = atom(
  null,
  (get, set, payload: { dataUrl: string; width: number; height: number }) => {
    const topo = get(topoAtom);
    set(commitAtom, {
      ...topo,
      imageDataUrl: payload.dataUrl,
      imageWidth: payload.width,
      imageHeight: payload.height,
    });
    // Transition out of "empty" once an image is loaded.
    if (get(editorModeAtom).kind === "empty") {
      set(editorModeAtom, { kind: "idle" });
    }
  },
);

// === Topo meta ===

export const setTopoNameAtom = atom(null, (get, set, name: string) => {
  set(commitAtom, { ...get(topoAtom), name });
});

export const setShowBannerAtom = atom(null, (get, set, showBanner: boolean) => {
  set(commitAtom, { ...get(topoAtom), showBanner });
});

export const setStartNumberAtom = atom(null, (get, set, startNumber: number) => {
  const topo = get(topoAtom);
  if (topo.routes.length === 0) {
    set(commitAtom, { ...topo, startNumber });
    return;
  }
  const minNum = Math.min(...topo.routes.map((r) => r.number));
  const delta = startNumber - minNum;
  set(commitAtom, {
    ...topo,
    startNumber,
    routes: topo.routes.map((r) => ({ ...r, number: r.number + delta })),
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
    points: [],
  };
  set(commitAtom, { ...topo, routes: [...topo.routes, route] });
  set(editorModeAtom, { kind: "drawing", routeId: id });
});

export const deleteRouteAtom = atom(null, (get, set, id: string) => {
  const topo = get(topoAtom);
  set(commitAtom, { ...topo, routes: topo.routes.filter((r) => r.id !== id) });
  const mode = get(editorModeAtom);
  if (mode.kind !== "empty" && "routeId" in mode && mode.routeId === id) {
    set(editorModeAtom, { kind: "idle" });
  }
});

const patchRoute = (topo: Topo, id: string, patch: Partial<Route>): Topo => ({
  ...topo,
  routes: topo.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
});

export const setRouteNameAtom = atom(null, (get, set, payload: { id: string; name: string }) => {
  set(commitAtom, patchRoute(get(topoAtom), payload.id, { name: payload.name }));
});

export const setRouteNumberAtom = atom(null, (get, set, payload: { id: string; number: number }) => {
  set(commitAtom, patchRoute(get(topoAtom), payload.id, { number: payload.number }));
});

export const setRouteColorAtom = atom(null, (get, set, payload: { id: string; color: RouteColor }) => {
  set(commitAtom, patchRoute(get(topoAtom), payload.id, { color: payload.color }));
});

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
  set(commitAtom, patchRoute(topo, m.routeId, { points: [...route.points, p] }));
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
    set(topoAtom, {
      ...topo,
      routes: topo.routes.map((r) =>
        r.id === override.routeId
          ? { ...r, points: r.points.map((p, i) => (i === override.pointIndex ? override.point : p)) }
          : r,
      ),
    });
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
    set(commitAtom, patchRoute(topo, payload.routeId, { points }));
  },
);

export const deletePointAtom = atom(
  null,
  (get, set, payload: { routeId: string; index: number }) => {
    const topo = get(topoAtom);
    const route = topo.routes.find((r) => r.id === payload.routeId);
    if (!route) return;
    const points = route.points.filter((_, i) => i !== payload.index);
    set(commitAtom, patchRoute(topo, payload.routeId, { points }));
  },
);

// === Annotations ===

const patchAnnotation = (topo: Topo, id: string, patch: Partial<Annotation>): Topo => ({
  ...topo,
  annotations: topo.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
});

export const createAnnotationAtom = atom(null, (get, set, payload: { x: number; y: number; text?: string }) => {
  const topo = get(topoAtom);
  const id = uid();
  const annotation: Annotation = {
    id,
    text: payload.text ?? "",
    x: payload.x,
    y: payload.y,
  };
  set(commitAtom, { ...topo, annotations: [...topo.annotations, annotation] });
  set(selectedAnnotationIdAtom, id);
});

export const setAnnotationTextAtom = atom(
  null,
  (get, set, payload: { id: string; text: string }) => {
    set(commitAtom, patchAnnotation(get(topoAtom), payload.id, { text: payload.text }));
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
  set(commitAtom, { ...topo, annotations: topo.annotations.filter((a) => a.id !== id) });
  if (get(selectedAnnotationIdAtom) === id) set(selectedAnnotationIdAtom, null);
});

export const beginAnnotationDragAtom = atom(null, (_get, set) => {
  set(snapshotHistoryAtom);
});
