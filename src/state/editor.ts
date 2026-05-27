import type { Process, Reducer } from "@zaymonoid/katha";
import { combinators } from "@zaymonoid/katha";
import { Effect, Ref, Stream } from "effect";
import type { EditorMode } from "./mode";
import type { Action, State } from "./root";
import type { Point, Snapshot } from "./types";

// ============================================================================
// Actions
// ============================================================================
//
// External actions this reducer handles: none (it only owns mode/tool/selection
// state, and drag/* actions are part of this slice now — see below).

export type Tool = "select" | "draw" | "annotate" | "branch";

export type EditorAction =
  | { id: "mode/selectRoute"; data: { routeId: string } }
  | { id: "mode/deselect" }
  | { id: "mode/enterDrawing"; data: { routeId: string; resumed?: boolean } }
  | { id: "mode/finishDrawing" }
  | { id: "mode/cancelDrawing" }
  | { id: "mode/set"; data: EditorMode }
  | { id: "mode/selectAnnotation"; data: { id: string | null } }
  | { id: "tool/set"; data: Tool }
  // drag/* — the live drag overlay lives inside mode.dragging.livePosition,
  // so these actions belong to the editor slice.
  | { id: "drag/begin"; data: { routeId: string; pointIndex: number } }
  | {
      id: "drag/setLivePosition";
      data: { routeId: string; pointIndex: number; point: Point } | null;
    }
  | { id: "drag/end" };

// ============================================================================
// State
// ============================================================================

export type EditorState = {
  mode: EditorMode;
  currentTool: Tool;
  selectedAnnotationId: string | null;
};

export const editorInitialState: EditorState = {
  mode: { kind: "empty" },
  currentTool: "select",
  selectedAnnotationId: null,
};

// ============================================================================
// Reducer
// ============================================================================

export const editorReducer: Reducer<EditorState, Action> = (state, action) => {
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
          livePosition: null,
        },
      };
    case "drag/setLivePosition":
      // Only meaningful while dragging. action.data with a point updates the
      // overlay; null clears it (used after commit).
      if (state.mode.kind !== "dragging") return undefined;
      return {
        ...state,
        mode: { ...state.mode, livePosition: action.data?.point ?? null },
      };
    // drag/end intentionally NOT handled here — dragSession needs to read
    // mode.dragging.livePosition before the mode transitions, so the process
    // orchestrates the commit AND the transition (via mode/selectRoute).
    default:
      return undefined;
  }
};

// ============================================================================
// Processes
// ============================================================================

const { takeEvery, takeLatest } = combinators<State, Action>();

// modeTransitions — coordinate follow-ups across actions:
// - Deleting the selected route auto-deselects.
// - Finishing/cancelling drawing on an empty route deletes the route.
export const modeTransitions: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    yield* takeEvery(["routes/delete"], (action, ctx) =>
      Effect.gen(function* () {
        if (action.id !== "routes/delete") return;
        const state = yield* ctx.select();
        const m = state.editor.mode;
        if (
          (m.kind === "selected" || m.kind === "drawing" || m.kind === "dragging") &&
          m.routeId === action.data.id
        ) {
          yield* ctx.put({ id: "mode/deselect" });
        }
      }),
    )(ctx);

    yield* takeEvery(["mode/finishDrawing", "mode/cancelDrawing"], (_action, ctx) =>
      Effect.gen(function* () {
        const state = yield* ctx.select();
        const m = state.editor.mode;
        if (m.kind !== "selected") return;
        const route = state.topo.snapshot.routes.find((r) => r.id === m.routeId);
        if (route && route.points.length === 0) {
          yield* ctx.put({ id: "routes/delete", data: { id: m.routeId } });
        }
      }),
    )(ctx);
  });

// extendSession — on mode/enterDrawing(resumed=true), snapshot the topo. On
// mode/cancelDrawing for that session, revert via topo/replaceContent.
// takeLatest ensures a new extend session cancels the previous one's listener.
export const extendSession: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    yield* takeLatest(["mode/enterDrawing"], (action, ctx) =>
      Effect.gen(function* () {
        if (action.id !== "mode/enterDrawing") return;
        if (!action.data.resumed) return;
        const captured = (yield* ctx.select()).topo.snapshot;
        const capturedRef = yield* Ref.make<Snapshot>(captured);

        yield* Stream.fromPubSub(ctx.actions).pipe(
          Stream.filter((a) => a.id === "mode/cancelDrawing" || a.id === "mode/finishDrawing"),
          Stream.take(1),
          Stream.runForEach((a) =>
            a.id === "mode/cancelDrawing"
              ? Ref.get(capturedRef).pipe(
                  Effect.flatMap((snap) => ctx.put({ id: "topo/replaceContent", data: snap })),
                )
              : Effect.void,
          ),
        );
      }),
    )(ctx);
  });

// dragSession — orchestrates the drag lifecycle:
//   - drag/begin   → push the pre-drag snapshot to history (one undo step).
//   - drag/end     → read mode.dragging.livePosition, commit via points/setPoint,
//                    then transition mode back to selected.
// The editor reducer deliberately does NOT handle drag/end so the process can
// see the live position before mode transitions.
export const dragSession: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    yield* takeLatest(["drag/begin"], (action, ctx) =>
      Effect.gen(function* () {
        if (action.id !== "drag/begin") return;
        const state = yield* ctx.select();
        yield* ctx.put({ id: "history/push", data: state.topo.snapshot });
      }),
    )(ctx);

    yield* takeEvery(["drag/end"], (_action, ctx) =>
      Effect.gen(function* () {
        const state = yield* ctx.select();
        const m = state.editor.mode;
        if (m.kind !== "dragging") return;
        if (m.livePosition) {
          yield* ctx.put({
            id: "points/setPoint",
            data: { routeId: m.routeId, pointIndex: m.pointIndex, point: m.livePosition },
          });
        }
        yield* ctx.put({ id: "mode/selectRoute", data: { routeId: m.routeId } });
      }),
    )(ctx);
  });
