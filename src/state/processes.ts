import type { Process } from "@zaymonoid/katha";
import { combinators } from "@zaymonoid/katha";
import { Duration, Effect, PubSub, Ref, Stream } from "effect";
import { listTopos, loadTopo, type StoredTopo, saveTopo } from "../util/storage";
import type { Action } from "./actions";
import type { State } from "./reducer";
import type { Snapshot } from "./types";

const { takeEvery, takeLatest, debounce } = combinators<State, Action>();

// ============================================================================
// historyTracker
// ============================================================================
//
// Subscribes to the action stream. Maintains a fiber-local "last seen content
// snapshot" Ref. When a history-worthy action arrives AND the resulting
// content differs from the ref, pushes the *previous* content (the ref's
// value at the time of dispatch) onto history.past. Non-history-worthy
// actions (undo, redo, replaceContent, loadFrom, drag/hover/mode/etc.) just
// update the ref silently so we always know the latest committed content.
//
// Single fiber, action-stream-only — no race between state-changes and
// action observations.

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
  });

// PubSub re-export kept for tests that may want to construct synthetic streams.
export { PubSub };

// ============================================================================
// autosave
// ============================================================================
//
// Debounce 500ms on any state-mutating action. After the quiet period, read
// the current state, build a StoredTopo record, persist via saveTopo, and
// dispatch save status actions.

const DEFAULT_SAVE_DEBOUNCE_MS = 500;
const HISTORY_CAP = 20;

const trimHistory = (h: State["history"]): State["history"] => ({
  past: h.past.slice(-HISTORY_CAP),
  future: h.future.slice(0, HISTORY_CAP),
});

const stateMutatingIds: Array<Action["id"]> = [
  "topo/setName",
  "topo/setImage",
  "topo/replaceContent",
  "display/setLineWidth",
  "display/setNumberSize",
  "display/setNumberingOffset",
  "display/setNumberingOrder",
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
  "annotations/setPos",
  "annotations/delete",
  "history/push",
  "history/clear",
  "history/restore",
];

const buildRecord = (state: State): StoredTopo => {
  const now = Date.now();
  return {
    id: state.topo.id,
    name: state.topo.name,
    updatedAt: now,
    image: state.topo.image,
    display: state.topo.display,
    metadata: { ...state.topo.metadata, updatedAt: now },
    snapshot: state.topo.snapshot,
    history: trimHistory(state.history),
  };
};

/** Build the autosave process with a configurable debounce window. */
export const makeAutosave =
  (debounceMs: number): Process<State, Action> =>
  (ctx) =>
    Effect.gen(function* () {
      yield* debounce(Duration.millis(debounceMs), stateMutatingIds, (_action, ctx) =>
        Effect.gen(function* () {
          // Don't persist until bootstrap has hydrated — otherwise we'd save
          // the empty initial state and clobber the on-disk record.
          const state = yield* ctx.select();
          if (!state.persistence.hydrated) return;

          yield* ctx.put({ id: "persistence/saveStarted" });
          const record = buildRecord(state);
          const result = yield* Effect.either(
            Effect.tryPromise({
              try: () => saveTopo(record),
              catch: (e) => (e instanceof Error ? e.message : String(e)),
            }),
          );
          if (result._tag === "Right") {
            yield* ctx.put({ id: "persistence/saveCompleted" });
          } else {
            yield* ctx.put({
              id: "persistence/saveFailed",
              data: { error: result.left },
            });
          }
        }),
      )(ctx);
    });

export const autosave = makeAutosave(DEFAULT_SAVE_DEBOUNCE_MS);

// ============================================================================
// bootstrap
// ============================================================================
//
// Runs once at startup. Loads the most-recently-updated topo from IndexedDB
// (if any), dispatches loadFrom + history/restore, then marks the persistence
// slice as hydrated. The historyTracker subscribes AFTER this completes
// (see rootProcess below) so it never observes the bootstrap's writes.

export const bootstrap: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    const metas = yield* Effect.tryPromise({
      try: () => listTopos(),
      catch: () => [] as never,
    }).pipe(Effect.catchAll(() => Effect.succeed([] as Awaited<ReturnType<typeof listTopos>>)));

    if (metas.length > 0) {
      const record = yield* Effect.tryPromise({
        try: () => loadTopo(metas[0].id),
        catch: () => null as never,
      }).pipe(Effect.catchAll(() => Effect.succeed(null as Awaited<ReturnType<typeof loadTopo>>)));
      if (record) {
        yield* ctx.put({
          id: "topo/loadFrom",
          data: {
            id: record.id,
            name: record.name,
            image: record.image,
            display: record.display,
            metadata: record.metadata,
            snapshot: record.snapshot,
          },
        });
        yield* ctx.put({
          id: "history/restore",
          data: { past: record.history.past, future: record.history.future },
        });
      }
    }
    yield* ctx.put({ id: "persistence/hydrated" });
  });

// ============================================================================
// dragSession
// ============================================================================
//
// On drag/begin: pushes the pre-drag snapshot onto history (so undo can revert
// the drag as a single step). The drag overlay slice receives per-frame writes
// from React event handlers. On drag/end: the *committed* point update is
// dispatched as a single points/setPoint action.

export const dragSession: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    yield* takeLatest(["drag/begin"], (action, ctx) =>
      Effect.gen(function* () {
        if (action.id !== "drag/begin") return; // narrow
        const state = yield* ctx.select();
        // Snapshot prev content into history so the drag is one undo step.
        yield* ctx.put({ id: "history/push", data: state.topo.snapshot });
      }),
    )(ctx);

    yield* takeEvery(["drag/end"], (_action, ctx) =>
      Effect.gen(function* () {
        const state = yield* ctx.select();
        const drag = state.drag.dragLivePosition;
        if (drag) {
          yield* ctx.put({
            id: "points/setPoint",
            data: { routeId: drag.routeId, pointIndex: drag.pointIndex, point: drag.point },
          });
          // Clear the overlay AFTER committing — the reducer left it alone
          // for exactly this reason (see dragReducer comment).
          yield* ctx.put({ id: "drag/setLivePosition", data: null });
        }
      }),
    )(ctx);
  });

// ============================================================================
// extendSession
// ============================================================================
//
// On mode/enterDrawing(resumed=true): capture the current content in a
// fiber-local Ref. On cancel of that same session: revert by dispatching
// topo/replaceContent with the captured snapshot. takeLatest ensures a new
// extend session cancels the previous one's listener.

export const extendSession: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    yield* takeLatest(["mode/enterDrawing"], (action, ctx) =>
      Effect.gen(function* () {
        if (action.id !== "mode/enterDrawing") return;
        if (!action.data.resumed) return;
        const captured = (yield* ctx.select()).topo.snapshot;
        const capturedRef = yield* Ref.make<Snapshot>(captured);

        // Wait for the next cancel/finish action via the action stream.
        // Implemented via a one-shot subscriber on cancel.
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

// ============================================================================
// imageLoad — decode uploaded files off the React tree
// ============================================================================

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
        // (errors are silently dropped for now; UI surface for them is TBD)
      }),
    )(ctx);
  });

// Reused from util/image.ts — local copy keeps processes.ts self-contained.
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

// ============================================================================
// modeTransitions — coordinate follow-ups across actions
// ============================================================================
//
// - When a route is deleted while it's selected, deselect.
// - When drawing finishes/cancels on a route with no points, delete the route.

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
        // The mode reducer has already moved to selected by the time we run.
        const m = state.editor.mode;
        if (m.kind !== "selected") return;
        const route = state.topo.snapshot.routes.find((r) => r.id === m.routeId);
        if (route && route.points.length === 0) {
          yield* ctx.put({ id: "routes/delete", data: { id: m.routeId } });
        }
      }),
    )(ctx);
  });

// ============================================================================
// devActionLogger — dev-only console log of every action through the store
// ============================================================================

const styleMain = "color: #888; font-weight: 400";
const styleId = "color: #2563eb; font-weight: 600";

export const devActionLogger: Process<State, Action> = (ctx) =>
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
// Order matters slightly: bootstrap runs to completion (it's not forked
// internally) before any tracker subscribes, so the load actions don't
// pollute the history.past stack via the tracker.

const IS_DEV =
  typeof import.meta !== "undefined" &&
  (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

export const rootProcess: Process<State, Action> = (ctx) =>
  Effect.gen(function* () {
    if (IS_DEV) yield* devActionLogger(ctx); // forks before bootstrap so load actions appear too
    yield* bootstrap(ctx); // awaits completion
    yield* historyTracker(ctx); // forks
    yield* autosave(ctx); // forks
    yield* dragSession(ctx); // forks
    yield* extendSession(ctx); // forks
    yield* imageLoad(ctx); // forks
    yield* modeTransitions(ctx); // forks
  });
