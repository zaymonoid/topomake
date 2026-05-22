import { combineReducers, type Reducer } from "@zaymonoid/katha";
import type { Action, Tool } from "./actions";
import type { EditorMode } from "./mode";
import { type Annotation, emptyTopo, type Route, type Snapshot, type Topo } from "./types";

// ============================================================================
// State shape
// ============================================================================

export type HistoryState = { past: Snapshot[]; future: Snapshot[] };

export type EditorState = {
  mode: EditorMode;
  currentTool: Tool;
  selectedAnnotationId: string | null;
};

export type DragState = {
  dragLivePosition: { routeId: string; pointIndex: number; point: { x: number; y: number } } | null;
};

export type HoverState = {
  hoveredHandle: { routeId: string; index: number } | null;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type PersistenceState = {
  saveStatus: SaveStatus;
  hydrated: boolean;
};

export type State = {
  topo: Topo;
  history: HistoryState;
  editor: EditorState;
  drag: DragState;
  hover: HoverState;
  persistence: PersistenceState;
};

export const initialState: State = {
  topo: emptyTopo("__initial__"),
  history: { past: [], future: [] },
  editor: { mode: { kind: "empty" }, currentTool: "select", selectedAnnotationId: null },
  drag: { dragLivePosition: null },
  hover: { hoveredHandle: null },
  persistence: { saveStatus: "idle", hydrated: false },
};

// ============================================================================
// Pure helpers — lifted from the legacy Jotai actions.ts for reuse in reducer
// ============================================================================

// Apply a content mutation to a topo. The history process discriminates user
// edits from restores by inspecting the action ID stream, so this helper just
// does the spread — no version bookkeeping needed.
const patchContent = (topo: Topo, mutate: (s: Snapshot) => Snapshot): Topo => ({
  ...topo,
  snapshot: mutate(topo.snapshot),
});

// Collect a route id and all its transitive variation descendants.
const collectWithDescendants = (rootId: string, routes: Route[]): Set<string> => {
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
};

// After a parent's points have been mutated, adjust descendants' branchFrom.atIndex.
const adjustAnchorsAfterPointChange = (
  routes: Route[],
  parentRouteId: string,
  kind: "insert" | "delete",
  index: number,
): { routes: Route[]; orphanedVariationIds: string[] } => {
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
};

const patchRoute = (snap: Snapshot, id: string, patch: Partial<Route>): Snapshot => ({
  ...snap,
  routes: snap.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
});

const patchAnnotation = (snap: Snapshot, id: string, patch: Partial<Annotation>): Snapshot => ({
  ...snap,
  annotations: snap.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
});

// ============================================================================
// topo slice
// ============================================================================

const topoReducer: Reducer<Topo, Action> = (state, action) => {
  switch (action.id) {
    // --- identity / image / load ---
    case "topo/setName":
      return { ...state, name: action.data };
    case "topo/setImage":
      return { ...state, image: action.data };
    case "topo/loadFrom":
      return action.data;
    case "topo/new":
      return emptyTopo(action.data.id);
    case "topo/replaceContent":
      return { ...state, snapshot: action.data };

    // --- display (no version bump) ---
    case "display/setLineWidth":
      return { ...state, display: { ...state.display, lineWidth: action.data } };
    case "display/setNumberSize":
      return { ...state, display: { ...state.display, numberSize: action.data } };
    case "display/setNumberingOffset":
      return {
        ...state,
        display: {
          ...state.display,
          numbering: { ...state.display.numbering, startOffset: action.data },
        },
      };
    case "display/setNumberingOrder":
      return {
        ...state,
        display: {
          ...state.display,
          numbering: { ...state.display.numbering, order: action.data },
        },
      };

    // --- routes (content; bump version) ---
    case "routes/create": {
      const r: Route = {
        id: action.data.id,
        name: "",
        color: "blue",
        finishStyle: "circle",
        points: [],
      };
      return patchContent(state, (s) => ({ ...s, routes: [...s.routes, r] }));
    }
    case "routes/delete": {
      const toRemove = collectWithDescendants(action.data.id, state.snapshot.routes);
      return patchContent(state, (s) => ({
        ...s,
        routes: s.routes.filter((r) => !toRemove.has(r.id)),
      }));
    }
    case "routes/setName":
      return patchContent(state, (s) => patchRoute(s, action.data.id, { name: action.data.name }));
    case "routes/setColor":
      return patchContent(state, (s) =>
        patchRoute(s, action.data.id, { color: action.data.color }),
      );
    case "routes/setFinishStyle":
      return patchContent(state, (s) =>
        patchRoute(s, action.data.id, { finishStyle: action.data.finishStyle }),
      );
    case "routes/branch": {
      const parent = state.snapshot.routes.find((r) => r.id === action.data.parentRouteId);
      if (!parent) return undefined;
      if (action.data.atIndex < 0 || action.data.atIndex >= parent.points.length) {
        return undefined;
      }
      const variation: Route = {
        id: action.data.id,
        name: "",
        color: parent.color,
        finishStyle: "circle",
        points: [],
        branchFrom: { routeId: parent.id, atIndex: action.data.atIndex },
      };
      return patchContent(state, (s) => ({ ...s, routes: [...s.routes, variation] }));
    }

    // --- points (content; bump version) ---
    case "points/append": {
      const route = state.snapshot.routes.find((r) => r.id === action.data.routeId);
      if (!route) return undefined;
      return patchContent(state, (s) =>
        patchRoute(s, action.data.routeId, { points: [...route.points, action.data.point] }),
      );
    }
    case "points/insert": {
      const { routeId, index, point } = action.data;
      const route = state.snapshot.routes.find((r) => r.id === routeId);
      if (!route) return undefined;
      const points = [...route.points];
      points.splice(index, 0, point);
      const withParent = state.snapshot.routes.map((r) =>
        r.id === routeId ? { ...r, points } : r,
      );
      const { routes: shifted } = adjustAnchorsAfterPointChange(
        withParent,
        routeId,
        "insert",
        index,
      );
      return patchContent(state, (s) => ({ ...s, routes: shifted }));
    }
    case "points/delete": {
      const { routeId, index } = action.data;
      const route = state.snapshot.routes.find((r) => r.id === routeId);
      if (!route) return undefined;
      const points = route.points.filter((_, i) => i !== index);
      const withParent = state.snapshot.routes.map((r) =>
        r.id === routeId ? { ...r, points } : r,
      );
      const { routes: shifted, orphanedVariationIds } = adjustAnchorsAfterPointChange(
        withParent,
        routeId,
        "delete",
        index,
      );
      let pruned = shifted;
      if (orphanedVariationIds.length > 0) {
        const toRemove = new Set<string>();
        for (const id of orphanedVariationIds) {
          for (const x of collectWithDescendants(id, shifted)) toRemove.add(x);
        }
        pruned = shifted.filter((r) => !toRemove.has(r.id));
      }
      return patchContent(state, (s) => ({ ...s, routes: pruned }));
    }
    case "points/setPoint": {
      const { routeId, pointIndex, point } = action.data;
      const route = state.snapshot.routes.find((r) => r.id === routeId);
      if (!route) return undefined;
      const points = route.points.map((p, i) => (i === pointIndex ? point : p));
      return patchContent(state, (s) => patchRoute(s, routeId, { points }));
    }

    // --- annotations ---
    case "annotations/create": {
      const a: Annotation = {
        id: action.data.id,
        text: action.data.text ?? "",
        x: action.data.x,
        y: action.data.y,
      };
      return patchContent(state, (s) => ({ ...s, annotations: [...s.annotations, a] }));
    }
    case "annotations/setText":
      return patchContent(state, (s) =>
        patchAnnotation(s, action.data.id, { text: action.data.text }),
      );
    case "annotations/setColor":
      return patchContent(state, (s) =>
        patchAnnotation(s, action.data.id, { color: action.data.color }),
      );
    case "annotations/setPos":
      // Drag-shaped: update content but DO NOT bump version. The drag-begin
      // dispatch site is responsible for pushing the pre-drag snapshot to
      // history.past via history/push.
      return {
        ...state,
        snapshot: patchAnnotation(state.snapshot, action.data.id, {
          x: action.data.x,
          y: action.data.y,
        }),
      };
    case "annotations/delete":
      return patchContent(state, (s) => ({
        ...s,
        annotations: s.annotations.filter((a) => a.id !== action.data.id),
      }));

    default:
      return undefined;
  }
};

// ============================================================================
// history slice
// ============================================================================

const historyReducer: Reducer<HistoryState, Action> = (state, action) => {
  switch (action.id) {
    case "history/push":
      return { past: [...state.past, action.data], future: [] };
    case "history/clear":
      return { past: [], future: [] };
    case "history/restore":
      return { past: action.data.past, future: action.data.future };
    // history/undo and history/redo are handled at the root reducer level
    // because they need cross-slice access (move snapshots between
    // history.past/future AND topo.content atomically).
    default:
      return undefined;
  }
};

// ============================================================================
// editor slice
// ============================================================================

const editorReducer: Reducer<EditorState, Action> = (state, action) => {
  switch (action.id) {
    case "mode/selectRoute":
      return { ...state, mode: { kind: "selected", routeId: action.data.routeId } };
    case "mode/deselect":
      return { ...state, mode: { kind: "idle" }, selectedAnnotationId: null };
    case "mode/enterDrawing":
      return {
        ...state,
        mode: {
          kind: "drawing",
          routeId: action.data.routeId,
          resumed: action.data.resumed,
        },
      };
    case "mode/finishDrawing":
    case "mode/cancelDrawing":
      // The route id is preserved via mode/selectRoute dispatched by the
      // process that handles drawing completion. The reducer just transitions
      // to idle here; mode coordination lives in the modeTransitions process.
      return state.mode.kind === "drawing"
        ? { ...state, mode: { kind: "selected", routeId: state.mode.routeId } }
        : undefined;
    case "mode/set":
      return { ...state, mode: action.data };
    case "mode/selectAnnotation":
      return { ...state, selectedAnnotationId: action.data.id };
    case "tool/set":
      return { ...state, currentTool: action.data };
    case "drag/begin":
      return {
        ...state,
        mode: {
          kind: "dragging",
          routeId: action.data.routeId,
          pointIndex: action.data.pointIndex,
        },
      };
    case "drag/end":
      return state.mode.kind === "dragging"
        ? { ...state, mode: { kind: "selected", routeId: state.mode.routeId } }
        : undefined;
    default:
      return undefined;
  }
};

// ============================================================================
// drag slice (live overlay)
// ============================================================================

const dragReducer: Reducer<DragState, Action> = (_state, action) => {
  switch (action.id) {
    case "drag/begin":
      return { dragLivePosition: null };
    case "drag/setLivePosition":
      return { dragLivePosition: action.data };
    // drag/end intentionally NOT handled here — the dragSession process needs
    // to read dragLivePosition before it's cleared. The process dispatches
    // drag/setLivePosition(null) after committing the final position.
    default:
      return undefined;
  }
};

// ============================================================================
// hover slice (live overlay)
// ============================================================================

const hoverReducer: Reducer<HoverState, Action> = (_state, action) => {
  switch (action.id) {
    case "hover/set":
      return { hoveredHandle: action.data };
    case "hover/clear":
      return { hoveredHandle: null };
    case "tool/set":
      // Clear hover when leaving the branch tool.
      return action.data === "branch" ? undefined : { hoveredHandle: null };
    default:
      return undefined;
  }
};

// ============================================================================
// persistence slice
// ============================================================================

const persistenceReducer: Reducer<PersistenceState, Action> = (state, action) => {
  switch (action.id) {
    case "persistence/saveStarted":
      return { ...state, saveStatus: "saving" };
    case "persistence/saveCompleted":
      return { ...state, saveStatus: "saved" };
    case "persistence/saveFailed":
      return { ...state, saveStatus: "error" };
    case "persistence/hydrated":
      return { ...state, hydrated: true, saveStatus: "saved" };
    default:
      return undefined;
  }
};

// ============================================================================
// Root reducer — handles cross-slice atomics; delegates the rest
// ============================================================================

const combined = combineReducers({
  topo: topoReducer,
  history: historyReducer,
  editor: editorReducer,
  drag: dragReducer,
  hover: hoverReducer,
  persistence: persistenceReducer,
});

export const rootReducer: Reducer<State, Action> = (state, action) => {
  // Cross-slice atomic moves between history.past/future and topo.snapshot.
  if (action.id === "history/undo") {
    const prev = state.history.past[state.history.past.length - 1];
    if (!prev) return undefined;
    return {
      ...state,
      topo: { ...state.topo, snapshot: prev },
      history: {
        past: state.history.past.slice(0, -1),
        future: [state.topo.snapshot, ...state.history.future],
      },
    };
  }
  if (action.id === "history/redo") {
    const next = state.history.future[0];
    if (!next) return undefined;
    return {
      ...state,
      topo: { ...state.topo, snapshot: next },
      history: {
        past: [...state.history.past, state.topo.snapshot],
        future: state.history.future.slice(1),
      },
    };
  }
  // topo/new: also clear history (a fresh topo has no past).
  if (action.id === "topo/new") {
    return {
      ...state,
      topo: emptyTopo(action.data.id),
      history: { past: [], future: [] },
    };
  }
  return combined(state, action);
};
