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
import { nextRouteNumberAtom } from "./computed";
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

// Reassigns `number` on each route per the chosen order.
// Variations (branchFrom set) are excluded from numbering and keep number = 0.
// "created" -> non-variations unchanged. "ltr" / "rtl" -> stable sort by start.x, assign from startNumber.
// Routes without points keep their relative order at the end of the sequence.
function applyNumbering(routes: Route[], startNumber: number, order: NumberingOrder): Route[] {
  const numberableInput = routes.filter((r) => r.branchFrom === undefined);
  let numbered: Route[];
  if (order === "created") {
    numbered = numberableInput;
  } else {
    const decorated = numberableInput.map((r, i) => ({ r, i }));
    const withPoints = decorated.filter((d) => d.r.points.length > 0);
    const withoutPoints = decorated.filter((d) => d.r.points.length === 0);
    withPoints.sort((a, b) => {
      const dx = a.r.points[0].x - b.r.points[0].x;
      if (dx !== 0) return order === "ltr" ? dx : -dx;
      return a.i - b.i;
    });
    const ordered = [...withPoints, ...withoutPoints].map((d) => d.r);
    numbered = ordered.map((r, i) => ({ ...r, number: startNumber + i }));
  }
  // Preserve original order of all routes, but with renumbered fields applied.
  const byId = new Map(numbered.map((r) => [r.id, r]));
  return routes.map((r) =>
    r.branchFrom === undefined ? (byId.get(r.id) ?? r) : { ...r, number: 0 },
  );
}

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
// `kind` tells us what happened so we can shift correctly.
//   "insert" at index i: any anchor at i or later shifts up by 1.
//   "delete" at index i: any anchor at i is orphaned -> caller should remove that variation;
//                        any anchor at i+1 or later shifts down by 1.
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
    // delete
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

const numbered = (t: Topo, routes: Route[]): Route[] =>
  applyNumbering(routes, t.startNumber, t.numberingOrder);

const snapshotOf = (t: Topo): Snapshot => ({
  startNumber: t.startNumber,
  numberingOrder: t.numberingOrder,
  lineWidth: t.lineWidth,
  numberSize: t.numberSize,
  routes: t.routes,
  annotations: t.annotations,
});

const withRoutes = (t: Topo, routes: Route[]): Snapshot => ({
  startNumber: t.startNumber,
  numberingOrder: t.numberingOrder,
  lineWidth: t.lineWidth,
  numberSize: t.numberSize,
  routes,
  annotations: t.annotations,
});

const withRoutePatched = (t: Topo, id: string, patch: Partial<Route>): Snapshot =>
  withRoutes(
    t,
    t.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  );

const withAnnotationPatched = (t: Topo, id: string, patch: Partial<Annotation>): Snapshot => ({
  startNumber: t.startNumber,
  numberingOrder: t.numberingOrder,
  lineWidth: t.lineWidth,
  numberSize: t.numberSize,
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
    lineWidth: topo.lineWidth,
    numberSize: topo.numberSize,
    routes,
    annotations: topo.annotations,
  });
});

export const setNumberingOrderAtom = atom(null, (get, set, order: NumberingOrder) => {
  const topo = get(topoAtom);
  set(commitAtom, {
    startNumber: topo.startNumber,
    numberingOrder: order,
    lineWidth: topo.lineWidth,
    numberSize: topo.numberSize,
    routes: applyNumbering(topo.routes, topo.startNumber, order),
    annotations: topo.annotations,
  });
});

export const setLineWidthAtom = atom(null, (get, set, lineWidth: number) => {
  const topo = get(topoAtom);
  set(commitAtom, { ...snapshotOf(topo), lineWidth });
});

export const setNumberSizeAtom = atom(null, (get, set, numberSize: number) => {
  const topo = get(topoAtom);
  set(commitAtom, { ...snapshotOf(topo), numberSize });
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

// Re-enter drawing mode on an already-existing route so the user can append
// more points to its end. Captures a snapshot so cancelDrawing can revert.
export const extendRouteAtom = atom(null, (get, set, routeId: string) => {
  const topo = get(topoAtom);
  const route = topo.routes.find((r) => r.id === routeId);
  if (!route) return;
  set(extendStartSnapshotAtom, snapshotOf(topo));
  set(currentToolAtom, "draw");
  set(editorModeAtom, { kind: "drawing", routeId, resumed: true });
});

export const deleteRouteAtom = atom(null, (get, set, id: string) => {
  const topo = get(topoAtom);
  const toRemove = collectWithDescendants(id, topo.routes);
  set(
    commitAtom,
    withRoutes(
      topo,
      numbered(
        topo,
        topo.routes.filter((r) => !toRemove.has(r.id)),
      ),
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
// starts with empty `points` — drawing mode appends from there. Its first rendered
// segment runs from the parent's anchor node to its first divergent point.
export const branchRouteAtom = atom(
  null,
  (get, set, payload: { parentRouteId: string; atIndex: number }) => {
    const topo = get(topoAtom);
    const parent = topo.routes.find((r) => r.id === payload.parentRouteId);
    if (!parent) return;
    if (payload.atIndex < 0 || payload.atIndex >= parent.points.length) return;
    const id = uid();
    const variation: Route = {
      id,
      number: 0,
      name: "",
      color: parent.color,
      finishStyle: "circle",
      points: [],
      branchFrom: { routeId: parent.id, atIndex: payload.atIndex },
    };
    set(commitAtom, withRoutes(topo, numbered(topo, [...topo.routes, variation])));
    set(editorModeAtom, { kind: "drawing", routeId: id });
  },
);

export const setRouteNameAtom = atom(null, (get, set, payload: { id: string; name: string }) => {
  set(commitAtom, withRoutePatched(get(topoAtom), payload.id, { name: payload.name }));
});

export const setRouteNumberAtom = atom(
  null,
  (get, set, payload: { id: string; number: number }) => {
    set(commitAtom, withRoutePatched(get(topoAtom), payload.id, { number: payload.number }));
  },
);

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
  const route = get(topoAtom).routes.find((r) => r.id === m.routeId);
  if (m.resumed) {
    // Extend session — the route already existed. Just exit drawing.
    set(extendStartSnapshotAtom, null);
    set(currentToolAtom, "select");
    set(editorModeAtom, { kind: "selected", routeId: m.routeId });
    return;
  }
  set(currentToolAtom, "select");
  // If the route ended up with no points, drop it.
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
  const route = get(topoAtom).routes.find((r) => r.id === m.routeId);
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
    const withParent = topo.routes.map((r) => (r.id === payload.routeId ? { ...r, points } : r));
    const { routes: shifted } = adjustAnchorsAfterPointChange(
      withParent,
      payload.routeId,
      "insert",
      payload.index,
    );
    // Re-number only when the start point changed (inserting at index 0).
    const routes = payload.index === 0 ? numbered(topo, shifted) : shifted;
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
    const withParent = topo.routes.map((r) => (r.id === payload.routeId ? { ...r, points } : r));
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
    // Re-number only when the start point changed (removing index 0).
    const routes = payload.index === 0 ? numbered(topo, pruned) : pruned;
    set(commitAtom, withRoutes(topo, routes));
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
      startNumber: topo.startNumber,
      numberingOrder: topo.numberingOrder,
      lineWidth: topo.lineWidth,
      numberSize: topo.numberSize,
      routes: topo.routes,
      annotations: [...topo.annotations, annotation],
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
    lineWidth: topo.lineWidth,
    numberSize: topo.numberSize,
    routes: topo.routes,
    annotations: topo.annotations.filter((a) => a.id !== id),
  });
  if (get(selectedAnnotationIdAtom) === id) set(selectedAnnotationIdAtom, null);
});

export const beginAnnotationDragAtom = atom(null, (_get, set) => {
  set(snapshotHistoryAtom);
});
