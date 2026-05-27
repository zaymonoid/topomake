/**
 * Process tests boot real katha stores with the process(es) under test and a
 * minimal reducer surface. The state-stream side is exercised end-to-end
 * (dispatch → reduce → process reaction → re-dispatch). Storage I/O is
 * mocked via vi.mock above the imports.
 */
import { it } from "@effect/vitest";
import { makeStore } from "@zaymonoid/katha";
import { Duration, Effect } from "effect";
import { beforeEach, describe, expect, vi } from "vitest";
import type { StoredTopo } from "../util/storage";

vi.mock("../util/storage", () => ({
  listTopos: vi.fn(),
  loadTopo: vi.fn(),
  saveTopo: vi.fn(),
  deleteTopo: vi.fn(),
}));

import * as storage from "../util/storage";
import { dragSession, extendSession, modeTransitions } from "./editor";
import { historyTracker } from "./history";
import { bootstrap, makeAutosave } from "./persistence";
import { initialState, rootReducer, type State } from "./root";

const mocked = vi.mocked(storage);

beforeEach(() => {
  vi.clearAllMocks();
  // sensible defaults
  mocked.listTopos.mockResolvedValue([]);
  mocked.loadTopo.mockResolvedValue(null);
  mocked.saveTopo.mockResolvedValue();
});

const hydratedInitial: State = {
  ...initialState,
  persistence: { saveStatus: "saved", hydrated: true },
};

// ============================================================================
// historyTracker
// ============================================================================

describe("historyTracker", () => {
  it.scopedLive("pushes prev content on history-worthy actions", () =>
    Effect.gen(function* () {
      const store = yield* makeStore({
        initialState: hydratedInitial,
        reduce: rootReducer,
        process: historyTracker,
      });
      // Let tracker subscribe + observe initial state
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "routes/create", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(10));
      const s = yield* store.select();
      expect(s.history.past).toHaveLength(1);
      // The pushed snapshot was the prev (initial) content — empty routes.
      expect(s.history.past[0].routes).toEqual([]);
      expect(s.topo.snapshot.routes).toHaveLength(1);
    }),
  );

  it.scopedLive("does NOT push on undo (undo + redo)", () =>
    Effect.gen(function* () {
      const store = yield* makeStore({
        initialState: hydratedInitial,
        reduce: rootReducer,
        process: historyTracker,
      });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "routes/create", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "routes/create", data: { id: "r2" } });
      yield* Effect.sleep(Duration.millis(10));
      // history.past now has 2 entries (one per user edit)
      let s = yield* store.select();
      expect(s.history.past).toHaveLength(2);

      yield* store.put({ id: "history/undo" });
      yield* Effect.sleep(Duration.millis(10));
      s = yield* store.select();
      // undo pops past, pushes current to future. Tracker observes content
      // change (version went DOWN), does NOT push back.
      expect(s.history.past).toHaveLength(1);
      expect(s.history.future).toHaveLength(1);
    }),
  );

  it.scopedLive("re-edits after undo create a new past entry without resurrecting future", () =>
    Effect.gen(function* () {
      const store = yield* makeStore({
        initialState: hydratedInitial,
        reduce: rootReducer,
        process: historyTracker,
      });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "routes/create", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "routes/create", data: { id: "r2" } });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "history/undo" });
      yield* Effect.sleep(Duration.millis(10));
      // Now make a brand new edit. history.future should clear via the push.
      yield* store.put({ id: "routes/create", data: { id: "r3" } });
      yield* Effect.sleep(Duration.millis(10));
      const s = yield* store.select();
      expect(s.history.future).toEqual([]);
      expect(s.topo.snapshot.routes.map((r) => r.id)).toEqual(["r1", "r3"]);
    }),
  );
});

// ============================================================================
// autosave
// ============================================================================

describe("autosave", () => {
  // Use a short real-time debounce so the test runtime doesn't pay 500ms per
  // case. The 500ms value is for the live app; the BEHAVIOR is identical.
  const FAST = 30;

  it.scopedLive("debounces and persists after the quiet period", () =>
    Effect.gen(function* () {
      const store = yield* makeStore({
        initialState: hydratedInitial,
        reduce: rootReducer,
        process: makeAutosave(FAST),
      });
      // Give the process fiber time to subscribe before we dispatch.
      yield* Effect.sleep(Duration.millis(20));
      yield* store.put({ id: "routes/create", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(15));
      expect(mocked.saveTopo).not.toHaveBeenCalled();
      yield* Effect.sleep(Duration.millis(50));
      expect(mocked.saveTopo).toHaveBeenCalledTimes(1);
      const s = yield* store.select();
      expect(s.persistence.saveStatus).toBe("saved");
    }),
  );

  it.scopedLive("a burst of actions collapses to a single save", () =>
    Effect.gen(function* () {
      const store = yield* makeStore({
        initialState: hydratedInitial,
        reduce: rootReducer,
        process: makeAutosave(FAST),
      });
      yield* Effect.sleep(Duration.millis(20));
      yield* store.put({ id: "routes/create", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "routes/create", data: { id: "r2" } });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "routes/create", data: { id: "r3" } });
      yield* Effect.sleep(Duration.millis(60));
      expect(mocked.saveTopo).toHaveBeenCalledTimes(1);
    }),
  );

  it.scopedLive("does not save while not hydrated", () =>
    Effect.gen(function* () {
      const store = yield* makeStore({
        initialState, // hydrated=false
        reduce: rootReducer,
        process: makeAutosave(FAST),
      });
      yield* Effect.sleep(Duration.millis(20));
      yield* store.put({ id: "routes/create", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(60));
      expect(mocked.saveTopo).not.toHaveBeenCalled();
    }),
  );

  it.scopedLive("actions that don't change the persistable slice do not trigger a save", () =>
    Effect.gen(function* () {
      const store = yield* makeStore({
        initialState: hydratedInitial,
        reduce: rootReducer,
        process: makeAutosave(FAST),
      });
      yield* Effect.sleep(Duration.millis(20));
      // None of these touch topo/history — autosave should stay quiet.
      yield* store.put({ id: "tool/set", data: "draw" });
      yield* store.put({ id: "hover/set", data: { routeId: "r1", index: 0 } });
      yield* store.put({ id: "mode/selectAnnotation", data: { id: "a1" } });
      yield* Effect.sleep(Duration.millis(60));
      expect(mocked.saveTopo).not.toHaveBeenCalled();
    }),
  );
});

// ============================================================================
// bootstrap
// ============================================================================

describe("bootstrap", () => {
  it.scopedLive("dispatches hydrated when no stored topos exist", () =>
    Effect.gen(function* () {
      mocked.listTopos.mockResolvedValue([]);
      const store = yield* makeStore({
        initialState,
        reduce: rootReducer,
        process: bootstrap,
      });
      yield* Effect.sleep(Duration.millis(20));
      const s = yield* store.select();
      expect(s.persistence.hydrated).toBe(true);
      expect(mocked.loadTopo).not.toHaveBeenCalled();
    }),
  );

  it.scopedLive("loads the most-recent topo and restores history", () =>
    Effect.gen(function* () {
      const record: StoredTopo = {
        id: "t1",
        name: "Loaded",
        updatedAt: 12345,
        image: null,
        display: initialState.topo.display,
        metadata: { updatedAt: 12345 },
        snapshot: { routes: [], annotations: [] },
        history: {
          past: [{ routes: [], annotations: [] }],
          future: [],
        },
      };
      mocked.listTopos.mockResolvedValue([{ id: "t1", name: "Loaded", updatedAt: 12345 }]);
      mocked.loadTopo.mockResolvedValue(record);

      const store = yield* makeStore({
        initialState,
        reduce: rootReducer,
        process: bootstrap,
      });
      yield* Effect.sleep(Duration.millis(20));
      const s = yield* store.select();
      expect(s.topo.id).toBe("t1");
      expect(s.topo.name).toBe("Loaded");
      expect(s.history.past).toHaveLength(1);
      expect(s.persistence.hydrated).toBe(true);
    }),
  );
});

// ============================================================================
// dragSession
// ============================================================================

describe("dragSession", () => {
  it.scopedLive("on begin: pushes prev content; on end: commits final position", () =>
    Effect.gen(function* () {
      const seed: State = {
        ...hydratedInitial,
        topo: {
          ...hydratedInitial.topo,

          snapshot: {
            routes: [
              {
                id: "r1",
                name: "",
                color: "blue",
                finishStyle: "circle",
                points: [{ x: 0, y: 0 }],
              },
            ],
            annotations: [],
          },
        },
      };
      const store = yield* makeStore({
        initialState: seed,
        reduce: rootReducer,
        process: dragSession,
      });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "drag/begin", data: { routeId: "r1", pointIndex: 0 } });
      yield* Effect.sleep(Duration.millis(10));
      // history.past now contains the pre-drag snapshot
      let s = yield* store.select();
      expect(s.history.past).toHaveLength(1);

      yield* store.put({
        id: "drag/setLivePosition",
        data: { routeId: "r1", pointIndex: 0, point: { x: 0.5, y: 0.5 } },
      });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "drag/end" });
      yield* Effect.sleep(Duration.millis(10));
      s = yield* store.select();
      expect(s.topo.snapshot.routes[0].points[0]).toEqual({ x: 0.5, y: 0.5 });
      // version should have bumped from the points/setPoint dispatch
    }),
  );
});

// ============================================================================
// extendSession
// ============================================================================

describe("extendSession", () => {
  it.scopedLive("cancel reverts to the captured snapshot", () =>
    Effect.gen(function* () {
      const startSnap = { routes: [], annotations: [] };
      const seed: State = {
        ...hydratedInitial,
        topo: { ...hydratedInitial.topo, snapshot: startSnap },
      };
      const store = yield* makeStore({
        initialState: seed,
        reduce: rootReducer,
        process: extendSession,
      });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({
        id: "mode/enterDrawing",
        data: { routeId: "r1", resumed: true },
      });
      yield* Effect.sleep(Duration.millis(10));
      // Mutate content
      yield* store.put({ id: "routes/create", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(10));
      let s = yield* store.select();
      expect(s.topo.snapshot.routes).toHaveLength(1);

      yield* store.put({ id: "mode/cancelDrawing" });
      yield* Effect.sleep(Duration.millis(10));
      s = yield* store.select();
      // Content reverted to the captured snapshot (preserving its version).
      expect(s.topo.snapshot).toEqual(startSnap);
    }),
  );

  it.scopedLive("finish does NOT revert", () =>
    Effect.gen(function* () {
      const seed: State = {
        ...hydratedInitial,
        topo: {
          ...hydratedInitial.topo,
          snapshot: { routes: [], annotations: [] },
        },
      };
      const store = yield* makeStore({
        initialState: seed,
        reduce: rootReducer,
        process: extendSession,
      });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({
        id: "mode/enterDrawing",
        data: { routeId: "r1", resumed: true },
      });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "routes/create", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "mode/finishDrawing" });
      yield* Effect.sleep(Duration.millis(10));
      const s = yield* store.select();
      // Content NOT reverted — finish keeps the additions
      expect(s.topo.snapshot.routes).toHaveLength(1);
    }),
  );
});

// ============================================================================
// modeTransitions
// ============================================================================

describe("modeTransitions", () => {
  it.scopedLive("deletes empty route on finishDrawing", () =>
    Effect.gen(function* () {
      const seed: State = {
        ...hydratedInitial,
        editor: {
          ...hydratedInitial.editor,
          mode: { kind: "drawing", routeId: "r1" },
        },
        topo: {
          ...hydratedInitial.topo,
          snapshot: {
            routes: [
              {
                id: "r1",
                name: "",
                color: "blue",
                finishStyle: "circle",
                points: [],
              },
            ],
            annotations: [],
          },
        },
      };
      const store = yield* makeStore({
        initialState: seed,
        reduce: rootReducer,
        process: modeTransitions,
      });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "mode/finishDrawing" });
      yield* Effect.sleep(Duration.millis(10));
      const s = yield* store.select();
      expect(s.topo.snapshot.routes).toHaveLength(0);
    }),
  );

  it.scopedLive("deselects when the selected route is deleted", () =>
    Effect.gen(function* () {
      const seed: State = {
        ...hydratedInitial,
        editor: {
          ...hydratedInitial.editor,
          mode: { kind: "selected", routeId: "r1" },
        },
        topo: {
          ...hydratedInitial.topo,
          snapshot: {
            routes: [
              {
                id: "r1",
                name: "",
                color: "blue",
                finishStyle: "circle",
                points: [],
              },
            ],
            annotations: [],
          },
        },
      };
      const store = yield* makeStore({
        initialState: seed,
        reduce: rootReducer,
        process: modeTransitions,
      });
      yield* Effect.sleep(Duration.millis(10));
      yield* store.put({ id: "routes/delete", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(10));
      const s = yield* store.select();
      expect(s.editor.mode).toEqual({ kind: "idle" });
    }),
  );
});
