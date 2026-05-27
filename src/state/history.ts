import type { Process, Reducer } from "@zaymonoid/katha";
import { combinators } from "@zaymonoid/katha";
import { Effect, Ref, Stream } from "effect";
import type { Action, State } from "./root";
import type { Snapshot } from "./types";

// ============================================================================
// Actions
// ============================================================================
//
// `history/undo` and `history/redo` are bare intents — no reducer handles them.
// A process intercepts them, reads state, and dispatches `snapshot/restore`
// carrying everything both reducers need. Two reducers (history + topo) react
// to the restore action in one tick. The action is namespaced `snapshot/`
// because its effect cross-cuts both slices.
//
// External actions this reducer handles:
//   - topo/new          → clears past/future (a fresh topo has no history)
//   - snapshot/restore  → sets past/future from payload

export type HistoryAction =
  | { id: "history/push"; data: Snapshot }
  | { id: "history/undo" }
  | { id: "history/redo" }
  | { id: "history/clear" }
  | { id: "history/restore"; data: { past: Snapshot[]; future: Snapshot[] } }
  | {
      id: "snapshot/restore";
      data: { snapshot: Snapshot; past: Snapshot[]; future: Snapshot[] };
    };

// ============================================================================
// State
// ============================================================================

export type HistoryState = { past: Snapshot[]; future: Snapshot[] };

export const historyInitialState: HistoryState = { past: [], future: [] };

// ============================================================================
// Reducer
// ============================================================================

export const historyReducer: Reducer<HistoryState, Action> = (state, action) => {
  switch (action.id) {
    case "history/push":
      return { past: [...state.past, action.data], future: [] };
    case "history/clear":
      return { past: [], future: [] };
    case "history/restore":
      return { past: action.data.past, future: action.data.future };
    case "snapshot/restore":
      return { past: action.data.past, future: action.data.future };
    // topo/new also clears history (a fresh topo has no past).
    case "topo/new":
      return { past: [], future: [] };
    default:
      return undefined;
  }
};

// ============================================================================
// Processes
// ============================================================================

const { takeEvery } = combinators<State, Action>();

// Translate bare undo/redo intents into enriched apply actions that both the
// history reducer and the topo reducer consume in a single tick.
const undoRedoOrchestrator: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    yield* takeEvery(["history/undo", "history/redo"], (action, ctx) =>
      Effect.gen(function* () {
        const state = yield* ctx.select();
        if (action.id === "history/undo") {
          const prev = state.history.past[state.history.past.length - 1];
          if (!prev) return;
          yield* ctx.put({
            id: "snapshot/restore",
            data: {
              snapshot: prev,
              past: state.history.past.slice(0, -1),
              future: [state.topo.snapshot, ...state.history.future],
            },
          });
        } else {
          const next = state.history.future[0];
          if (!next) return;
          yield* ctx.put({
            id: "snapshot/restore",
            data: {
              snapshot: next,
              past: [...state.history.past, state.topo.snapshot],
              future: state.history.future.slice(1),
            },
          });
        }
      }),
    )(ctx);
  });

// historyTracker — push the pre-action snapshot onto past whenever a
// history-worthy action mutates content.

const HISTORY_WORTHY: ReadonlySet<Action["id"]> = new Set([
  "routes/create",
  "routes/delete",
  "routes/setName",
  "routes/setColor",
  "routes/setFinishStyle",
  "routes/branch",
  "points/append",
  "points/insert",
  "points/delete",
  "points/setPoint",
  "annotations/create",
  "annotations/setText",
  "annotations/setColor",
  "annotations/delete",
  // annotations/setPos is NOT history-worthy — the drag-begin dispatch site
  // pushes the snapshot to history explicitly; per-frame moves stay quiet.
]);

export const historyTracker: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    const initial = (yield* ctx.select()).topo.snapshot;
    const lastContent = yield* Ref.make<Snapshot>(initial);

    yield* Effect.forkScoped(
      Stream.fromPubSub(ctx.actions).pipe(
        Stream.runForEach((action) =>
          Effect.gen(function* () {
            const prev = yield* Ref.get(lastContent);
            const post = (yield* ctx.select()).topo.snapshot;
            if (HISTORY_WORTHY.has(action.id) && prev !== post) {
              yield* ctx.put({ id: "history/push", data: prev });
            }
            yield* Ref.set(lastContent, post);
          }),
        ),
      ),
    );

    yield* undoRedoOrchestrator(ctx);
  });
