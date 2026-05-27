import type { Process, Reducer } from "@zaymonoid/katha";
import { combineReducers } from "@zaymonoid/katha";
import { Effect, Stream } from "effect";
import {
  dragSession,
  type EditorAction,
  type EditorState,
  editorInitialState,
  editorReducer,
  extendSession,
  modeTransitions,
} from "./editor";
import {
  type HistoryAction,
  type HistoryState,
  historyInitialState,
  historyReducer,
  historyTracker,
} from "./history";
import { type HoverAction, type HoverState, hoverInitialState, hoverReducer } from "./hover";
import {
  autosave,
  bootstrap,
  type PersistenceAction,
  type PersistenceState,
  persistenceInitialState,
  persistenceReducer,
} from "./persistence";
import { imageLoad, type TopoAction, topoInitialState, topoReducer } from "./topo";
import type { Topo } from "./types";

// ============================================================================
// Composed Action union
// ============================================================================

export type Action = TopoAction | HistoryAction | EditorAction | HoverAction | PersistenceAction;

// ============================================================================
// Composed State
// ============================================================================

export type State = {
  topo: Topo;
  history: HistoryState;
  editor: EditorState;
  hover: HoverState;
  persistence: PersistenceState;
};

export const initialState: State = {
  topo: topoInitialState,
  history: historyInitialState,
  editor: editorInitialState,
  hover: hoverInitialState,
  persistence: persistenceInitialState,
};

// ============================================================================
// Root reducer
// ============================================================================

export const rootReducer: Reducer<State, Action> = combineReducers({
  topo: topoReducer,
  history: historyReducer,
  editor: editorReducer,
  hover: hoverReducer,
  persistence: persistenceReducer,
});

// ============================================================================
// devActionLogger — dev-only console log of every action through the store
// ============================================================================

const styleMain = "color: #888; font-weight: 400";
const styleId = "color: #2563eb; font-weight: 600";

const devActionLogger: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    yield* Effect.forkScoped(
      Stream.fromPubSub(ctx.actions).pipe(
        Stream.runForEach((action) =>
          Effect.sync(() => {
            const data = "data" in action ? (action as { data: unknown }).data : undefined;
            if (data === undefined) {
              console.log(`%c[action]%c ${action.id}`, styleMain, styleId);
            } else {
              console.log(`%c[action]%c ${action.id}`, styleMain, styleId, data);
            }
          }),
        ),
      ),
    );
  });

// ============================================================================
// rootProcess — composes everything
// ============================================================================
//
// bootstrap runs to completion before any tracker subscribes, so its load
// actions don't pollute history.past via the tracker.

const IS_DEV =
  typeof import.meta !== "undefined" &&
  (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

export const rootProcess: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    if (IS_DEV) yield* devActionLogger(ctx);
    yield* bootstrap(ctx);
    yield* historyTracker(ctx);
    yield* autosave(ctx);
    yield* dragSession(ctx);
    yield* extendSession(ctx);
    yield* imageLoad(ctx);
    yield* modeTransitions(ctx);
  });
