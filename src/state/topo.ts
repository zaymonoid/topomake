import type { Process, Reducer } from "@zaymonoid/katha";
import { combinators } from "@zaymonoid/katha";
import { Effect } from "effect";
import type { Action, State } from "./root";
import {
  type Annotation,
  emptyTopo,
  type Image,
  type NumberingOrder,
  type Point,
  type Route,
  type RouteColor,
  type RouteFinishStyle,
  type Snapshot,
  type Topo,
} from "./types";

// ============================================================================
// Actions
// ============================================================================

export type TopoAction =
  // identity + image + load
  | { id: "topo/setName"; data: string }
  | { id: "topo/setImage"; data: Image }
  | { id: "topo/uploadImageRequested"; data: File }
  | { id: "topo/loadFrom"; data: Topo }
  | { id: "topo/new"; data: { id: string } }
  | { id: "topo/replaceContent"; data: Snapshot }
  // display
  | { id: "display/setLineWidth"; data: number }
  | { id: "display/setNumberSize"; data: number }
  | { id: "display/setNumberingOffset"; data: number }
  | { id: "display/setNumberingOrder"; data: NumberingOrder }
  // routes
  | { id: "routes/create"; data: { id: string } }
  | { id: "routes/delete"; data: { id: string } }
  | { id: "routes/setName"; data: { id: string; name: string } }
  | { id: "routes/setColor"; data: { id: string; color: RouteColor } }
  | { id: "routes/setFinishStyle"; data: { id: string; finishStyle: RouteFinishStyle } }
  | { id: "routes/branch"; data: { id: string; parentRouteId: string; atIndex: number } }
  // points
  | { id: "points/append"; data: { routeId: string; point: Point } }
  | { id: "points/insert"; data: { routeId: string; index: number; point: Point } }
  | { id: "points/delete"; data: { routeId: string; index: number } }
  | { id: "points/setPoint"; data: { routeId: string; pointIndex: number; point: Point } }
  // annotations
  | { id: "annotations/create"; data: { id: string; x: number; y: number; text?: string } }
  | { id: "annotations/setText"; data: { id: string; text: string } }
  | { id: "annotations/setColor"; data: { id: string; color: RouteColor } }
  | { id: "annotations/setPos"; data: { id: string; x: number; y: number } }
  | { id: "annotations/delete"; data: { id: string } };

// ============================================================================
// State
// ============================================================================

export const topoInitialState: Topo = emptyTopo("__initial__");

// ============================================================================
// Pure helpers
// ============================================================================

const patchContent = (topo: Topo, mutate: (s: Snapshot) => Snapshot): Topo => ({
  ...topo,
  snapshot: mutate(topo.snapshot),
});

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
// Reducer
// ============================================================================

export const topoReducer: Reducer<Topo, Action> = (state, action) => {
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
    case "snapshot/restore":
      return { ...state, snapshot: action.data.snapshot };

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

    // --- routes ---
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

    // --- points ---
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
// Processes
// ============================================================================

const { takeLatest } = combinators<State, Action>();

// imageLoad — decode uploaded files off the React tree. Dispatches
// topo/setImage on success, and nudges editor out of "empty" mode if needed.
export const imageLoad: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    yield* takeLatest(["topo/uploadImageRequested"], (action, ctx) =>
      Effect.gen(function* () {
        if (action.id !== "topo/uploadImageRequested") return;
        const file = action.data;
        const result = yield* Effect.either(
          Effect.tryPromise({
            try: () => decodeImageFile(file),
            catch: (e) => (e instanceof Error ? e.message : String(e)),
          }),
        );
        if (result._tag === "Right") {
          yield* ctx.put({ id: "topo/setImage", data: result.right });
          const state = yield* ctx.select();
          if (state.editor.mode.kind === "empty") {
            yield* ctx.put({ id: "mode/set", data: { kind: "idle" } });
          }
        }
      }),
    )(ctx);
  });

async function decodeImageFile(
  file: File,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
  const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = dataUrl;
  });
  return { dataUrl, ...dims };
}
