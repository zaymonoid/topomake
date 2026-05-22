import { atom } from "jotai";
import {
  commitAtom,
  currentToolAtom,
  dragOverrideAtom,
  editorModeAtom,
  extendStartSnapshotAtom,
  selectedAnnotationIdAtom,
  snapshotHistoryAtom,
  topoAtom,
} from "./atoms";
import type {
  Annotation,
  NumberingOrder,
  Point,
  Route,
  RouteColor,
  RouteFinishStyle,
  Snapshot,
  Topo,
} from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

// Collect a route id and all its transitive variation descendants.
function collectWithDescendants(rootId: string, routes: Route[]): Set<string> {
  const out = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const r of routes) {
      if (r.branchFrom && out.has(r.branchFrom.routeId) && !out.has(r.id)) {
        out.add(r.id);
        added = true;
      }
    }
  }
  return out;
}

// After a parent's points have been mutated, adjust descendants' branchFrom.atIndex.
//   "insert" at i: any anchor at i or later shifts up by 1.
//   "delete" at i: any anchor at i is orphaned -> caller should remove that variation;
//                  any anchor at i+1 or later shifts down by 1.
function adjustAnchorsAfterPointChange(
  routes: Route[],
  parentRouteId: string,
  kind: "insert" | "delete",
  index: number,
): { routes: Route[]; orphanedVariationIds: string[] } {
  const orphaned: string[] = [];
  const out = routes.map((r) => {
    if (!r.branchFrom || r.branchFrom.routeId !== parentRouteId) return r;
    const at = r.branchFrom.atIndex;
    if (kind === "insert") {
      return at >= index ? { ...r, branchFrom: { ...r.branchFrom, atIndex: at + 1 } } : r;
    }
    if (at === index) {
      orphaned.push(r.id);
      return r;
    }
    if (at > index) {
      return { ...r, branchFrom: { ...r.branchFrom, atIndex: at - 1 } };
    }
    return r;
  });
  return { routes: out, orphanedVariationIds: orphaned };
}

// Build a new snapshot from the current topo with a transformed routes list.
const withRoutes = (t: Topo, routes: Route[]): Snapshot => ({
  routes,
  annotations: t.snapshot.annotations,
});

const withRoutePatched = (t: Topo, id: string, patch: Partial<Route>): Snapshot =>
  withRoutes(
    t,
    t.snapshot.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  );

const withAnnotationPatched = (t: Topo, id: string, patch: Partial<Annotation>): Snapshot => ({
  routes: t.snapshot.routes,
  annotations: t.snapshot.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
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

// === Display prefs — not history-tracked ===

export const setLineWidthAtom = atom(null, (get, set, lineWidth: number) => {
  const t = get(topoAtom);
  set(topoAtom, { ...t, display: { ...t.display, lineWidth } });
});

export const setNumberSizeAtom = atom(null, (get, set, numberSize: number) => {
  const t = get(topoAtom);
  set(topoAtom, { ...t, display: { ...t.display, numberSize } });
});

export const setNumberingStartOffsetAtom = atom(null, (get, set, startOffset: number) => {
  const t = get(topoAtom);
  set(topoAtom, {
    ...t,
    display: { ...t.display, numbering: { ...t.display.numbering, startOffset } },
  });
});

export const setNumberingOrderAtom = atom(null, (get, set, order: NumberingOrder) => {
  const t = get(topoAtom);
  set(topoAtom, {
    ...t,
    display: { ...t.display, numbering: { ...t.display.numbering, order } },
  });
});

// === Routes ===

export const createRouteAtom = atom(null, (get, set) => {
  const topo = get(topoAtom);
  const id = uid();
  const route: Route = {
    id,
    name: "",
    color: "blue",
    finishStyle: "circle",
    points: [],
  };
  set(commitAtom, withRoutes(topo, [...topo.snapshot.routes, route]));
  set(editorModeAtom, { kind: "drawing", routeId: id });
});

// Re-enter drawing mode on an already-existing route so the user can append
// more points to its end. Captures a snapshot so cancelDrawing can revert.
export const extendRouteAtom = atom(null, (get, set, routeId: string) => {
  const topo = get(topoAtom);
  const route = topo.snapshot.routes.find((r) => r.id === routeId);
  if (!route) return;
  set(extendStartSnapshotAtom, topo.snapshot);
  set(currentToolAtom, "draw");
  set(editorModeAtom, { kind: "drawing", routeId, resumed: true });
});

export const deleteRouteAtom = atom(null, (get, set, id: string) => {
  const topo = get(topoAtom);
  const toRemove = collectWithDescendants(id, topo.snapshot.routes);
  set(
    commitAtom,
    withRoutes(
      topo,
      topo.snapshot.routes.filter((r) => !toRemove.has(r.id)),
    ),
  );
  const mode = get(editorModeAtom);
  if (mode.kind !== "empty" && "routeId" in mode && toRemove.has(mode.routeId)) {
    set(editorModeAtom, { kind: "idle" });
  }
});

// === Variations ===
//
// Spawn a new route that branches off `parentRouteId` at `atIndex`. The new route
// starts with empty `points` — drawing mode appends from there.
export const branchRouteAtom = atom(
  null,
  (get, set, payload: { parentRouteId: string; atIndex: number }) => {
    const topo = get(topoAtom);
    const parent = topo.snapshot.routes.find((r) => r.id === payload.parentRouteId);
    if (!parent) return;
    if (payload.atIndex < 0 || payload.atIndex >= parent.points.length) return;
    const id = uid();
    const variation: Route = {
      id,
      name: "",
      color: parent.color,
      finishStyle: "circle",
      points: [],
      branchFrom: { routeId: parent.id, atIndex: payload.atIndex },
    };
    set(commitAtom, withRoutes(topo, [...topo.snapshot.routes, variation]));
    set(editorModeAtom, { kind: "drawing", routeId: id });
  },
);

export const setRouteNameAtom = atom(null, (get, set, payload: { id: string; name: string }) => {
  set(commitAtom, withRoutePatched(get(topoAtom), payload.id, { name: payload.name }));
});

export const setRouteColorAtom = atom(
  null,
  (get, set, payload: { id: string; color: RouteColor }) => {
    set(commitAtom, withRoutePatched(get(topoAtom), payload.id, { color: payload.color }));
  },
);

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
  const route = get(topoAtom).snapshot.routes.find((r) => r.id === m.routeId);
  if (m.resumed) {
    // Extend session — the route already existed. Just exit drawing.
    set(extendStartSnapshotAtom, null);
    set(currentToolAtom, "select");
    set(editorModeAtom, { kind: "selected", routeId: m.routeId });
    return;
  }
  set(currentToolAtom, "select");
  if (route && route.points.length === 0) {
    set(deleteRouteAtom, m.routeId);
    return;
  }
  set(editorModeAtom, { kind: "selected", routeId: m.routeId });
});

export const cancelDrawingAtom = atom(null, (get, set) => {
  const m = get(editorModeAtom);
  if (m.kind !== "drawing") return;
  if (m.resumed) {
    // Extend session — revert to the snapshot captured when extend began.
    const snap = get(extendStartSnapshotAtom);
    if (snap) set(commitAtom, snap);
    set(extendStartSnapshotAtom, null);
    set(currentToolAtom, "select");
    set(editorModeAtom, { kind: "selected", routeId: m.routeId });
    return;
  }
  // Fresh drawing — treat Esc the same as Enter: finish, keeping the route.
  const route = get(topoAtom).snapshot.routes.find((r) => r.id === m.routeId);
  set(currentToolAtom, "select");
  if (route && route.points.length === 0) {
    set(deleteRouteAtom, m.routeId);
    return;
  }
  set(editorModeAtom, { kind: "selected", routeId: m.routeId });
});

// === Drawing — append a point while in drawing mode ===

export const appendPointAtom = atom(null, (get, set, p: Point) => {
  const m = get(editorModeAtom);
  if (m.kind !== "drawing") return;
  const topo = get(topoAtom);
  const route = topo.snapshot.routes.find((r) => r.id === m.routeId);
  if (!route) return;
  const updated = topo.snapshot.routes.map((r) =>
    r.id === m.routeId ? { ...r, points: [...r.points, p] } : r,
  );
  set(commitAtom, withRoutes(topo, updated));
});

// === Drag — target lives in the mode itself ===

export const beginDragAtom = atom(
  null,
  (_get, set, payload: { routeId: string; pointIndex: number }) => {
    set(snapshotHistoryAtom);
    set(dragOverrideAtom, null);
    set(editorModeAtom, {
      kind: "dragging",
      routeId: payload.routeId,
      pointIndex: payload.pointIndex,
    });
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
    const routes = topo.snapshot.routes.map((r) =>
      r.id === override.routeId
        ? { ...r, points: r.points.map((p, i) => (i === override.pointIndex ? override.point : p)) }
        : r,
    );
    set(topoAtom, { ...topo, snapshot: { ...topo.snapshot, routes } });
    set(dragOverrideAtom, null);
  }
  set(editorModeAtom, { kind: "selected", routeId: m.routeId });
});

// === Point manipulation ===

export const insertPointAtom = atom(
  null,
  (get, set, payload: { routeId: string; index: number; point: Point }) => {
    const topo = get(topoAtom);
    const route = topo.snapshot.routes.find((r) => r.id === payload.routeId);
    if (!route) return;
    const points = [...route.points];
    points.splice(payload.index, 0, payload.point);
    const withParent = topo.snapshot.routes.map((r) =>
      r.id === payload.routeId ? { ...r, points } : r,
    );
    const { routes: shifted } = adjustAnchorsAfterPointChange(
      withParent,
      payload.routeId,
      "insert",
      payload.index,
    );
    set(commitAtom, withRoutes(topo, shifted));
  },
);

export const deletePointAtom = atom(
  null,
  (get, set, payload: { routeId: string; index: number }) => {
    const topo = get(topoAtom);
    const route = topo.snapshot.routes.find((r) => r.id === payload.routeId);
    if (!route) return;
    const points = route.points.filter((_, i) => i !== payload.index);
    const withParent = topo.snapshot.routes.map((r) =>
      r.id === payload.routeId ? { ...r, points } : r,
    );
    const { routes: shifted, orphanedVariationIds } = adjustAnchorsAfterPointChange(
      withParent,
      payload.routeId,
      "delete",
      payload.index,
    );
    // Cascade-delete any variations whose anchor node was just removed.
    let pruned = shifted;
    if (orphanedVariationIds.length > 0) {
      const toRemove = new Set<string>();
      for (const id of orphanedVariationIds) {
        for (const x of collectWithDescendants(id, shifted)) toRemove.add(x);
      }
      pruned = shifted.filter((r) => !toRemove.has(r.id));
      const mode = get(editorModeAtom);
      if (mode.kind !== "empty" && "routeId" in mode && toRemove.has(mode.routeId)) {
        set(editorModeAtom, { kind: "idle" });
      }
    }
    set(commitAtom, withRoutes(topo, pruned));
  },
);

// === Annotations ===

export const createAnnotationAtom = atom(
  null,
  (get, set, payload: { x: number; y: number; text?: string }) => {
    const topo = get(topoAtom);
    const id = uid();
    const annotation: Annotation = {
      id,
      text: payload.text ?? "",
      x: payload.x,
      y: payload.y,
    };
    set(commitAtom, {
      routes: topo.snapshot.routes,
      annotations: [...topo.snapshot.annotations, annotation],
    });
    set(selectedAnnotationIdAtom, id);
  },
);

export const setAnnotationTextAtom = atom(
  null,
  (get, set, payload: { id: string; text: string }) => {
    set(commitAtom, withAnnotationPatched(get(topoAtom), payload.id, { text: payload.text }));
  },
);

export const setAnnotationColorAtom = atom(
  null,
  (get, set, payload: { id: string; color: RouteColor }) => {
    set(commitAtom, withAnnotationPatched(get(topoAtom), payload.id, { color: payload.color }));
  },
);

// Live position update used during drag — does NOT commit history (snapshot is taken at drag start).
export const setAnnotationPosAtom = atom(
  null,
  (get, set, payload: { id: string; x: number; y: number }) => {
    const topo = get(topoAtom);
    const annotations = topo.snapshot.annotations.map((a) =>
      a.id === payload.id ? { ...a, x: payload.x, y: payload.y } : a,
    );
    set(topoAtom, { ...topo, snapshot: { ...topo.snapshot, annotations } });
  },
);

export const deleteAnnotationAtom = atom(null, (get, set, id: string) => {
  const topo = get(topoAtom);
  set(commitAtom, {
    routes: topo.snapshot.routes,
    annotations: topo.snapshot.annotations.filter((a) => a.id !== id),
  });
  if (get(selectedAnnotationIdAtom) === id) set(selectedAnnotationIdAtom, null);
});

export const beginAnnotationDragAtom = atom(null, (_get, set) => {
  set(snapshotHistoryAtom);
});
