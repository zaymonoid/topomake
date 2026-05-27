import type { Process, Reducer } from "@zaymonoid/katha";
import { Duration, Effect, Ref, Stream } from "effect";
import { listTopos, loadTopo, type StoredTopo, saveTopo } from "../util/storage";
import type { HistoryState } from "./history";
import type { Action, State } from "./root";

// ============================================================================
// Actions
// ============================================================================

export type PersistenceAction =
  | { id: "persistence/saveStarted" }
  | { id: "persistence/saveCompleted" }
  | { id: "persistence/saveFailed"; data: { error: string } }
  | { id: "persistence/hydrated" };

// ============================================================================
// State
// ============================================================================

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type PersistenceState = {
  saveStatus: SaveStatus;
  hydrated: boolean;
};

export const persistenceInitialState: PersistenceState = {
  saveStatus: "idle",
  hydrated: false,
};

// ============================================================================
// Reducer
// ============================================================================

export const persistenceReducer: Reducer<PersistenceState, Action> = (state, action) => {
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
// Processes
// ============================================================================

const DEFAULT_SAVE_DEBOUNCE_MS = 500;
const HISTORY_CAP = 20;

const trimHistory = (h: HistoryState): HistoryState => ({
  past: h.past.slice(-HISTORY_CAP),
  future: h.future.slice(0, HISTORY_CAP),
});

// The fields persisted to IndexedDB. Reducers preserve referential identity
// when their slice doesn't change, so shallow-ref equality is a sound test
// for "anything we save has changed."
type PersistableSlice = {
  readonly id: string;
  readonly name: string;
  readonly image: State["topo"]["image"];
  readonly display: State["topo"]["display"];
  readonly metadata: State["topo"]["metadata"];
  readonly snapshot: State["topo"]["snapshot"];
  readonly past: HistoryState["past"];
  readonly future: HistoryState["future"];
};

const persistableSlice = (s: State): PersistableSlice => ({
  id: s.topo.id,
  name: s.topo.name,
  image: s.topo.image,
  display: s.topo.display,
  metadata: s.topo.metadata,
  snapshot: s.topo.snapshot,
  past: s.history.past,
  future: s.history.future,
});

const slicesEqual = (a: PersistableSlice, b: PersistableSlice): boolean =>
  a.id === b.id &&
  a.name === b.name &&
  a.image === b.image &&
  a.display === b.display &&
  a.metadata === b.metadata &&
  a.snapshot === b.snapshot &&
  a.past === b.past &&
  a.future === b.future;

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

/**
 * Autosave subscribes to the action stream but uses VALUE diff (not action
 * allowlist) to decide whether to schedule a save. Per-frame actions that
 * don't touch the persistable slice (e.g. drag/setLivePosition) never reset
 * the debounce timer.
 *
 * rootProcess awaits bootstrap before starting autosave, so the captured
 * initial slice is the post-bootstrap state.
 */
export const makeAutosave =
  (debounceMs: number): Process<State, Action> =>
  (ctx) =>
    Effect.gen(function* () {
      const initial = yield* ctx.select();
      const lastSavedSlice = yield* Ref.make<PersistableSlice>(persistableSlice(initial));

      yield* Effect.forkScoped(
        Stream.fromPubSub(ctx.actions).pipe(
          // persistence/* are autosave's own bookkeeping — exclude so they
          // don't loop back through the diff.
          Stream.filter((a) => !a.id.startsWith("persistence/")),
          Stream.mapEffect(() =>
            Effect.gen(function* () {
              const state = yield* ctx.select();
              const current = persistableSlice(state);
              const last = yield* Ref.get(lastSavedSlice);
              return slicesEqual(current, last) ? null : current;
            }),
          ),
          Stream.filter((x): x is PersistableSlice => x !== null),
          Stream.debounce(Duration.millis(debounceMs)),
          Stream.runForEach(() =>
            Effect.gen(function* () {
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
                yield* Ref.set(lastSavedSlice, persistableSlice(state));
              } else {
                yield* ctx.put({ id: "persistence/saveFailed", data: { error: result.left } });
              }
            }),
          ),
        ),
      );
    });

export const autosave = makeAutosave(DEFAULT_SAVE_DEBOUNCE_MS);

// bootstrap — runs once at startup. Loads the most-recently-updated topo
// from IndexedDB (if any), dispatches loadFrom + history/restore, then marks
// the persistence slice as hydrated. The historyTracker subscribes AFTER this
// completes so the bootstrap's writes don't pollute history.past.
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
