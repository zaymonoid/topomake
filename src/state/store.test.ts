/**
 * End-to-end scenario tests. Boot a full katha store with the real rootProcess
 * (which composes every process — historyTracker, autosave, dragSession,
 * extendSession, modeTransitions, imageLoad, bootstrap) against stubbed
 * storage I/O. Then run user-shaped action sequences and assert final state.
 *
 * These are the regression tests for the bugs the migration aims to fix:
 * - slider drags polluting undo history (fk47)
 * - drag overlay leaking into committed state
 * - extend-cancel reverting correctly
 */
import { it } from "@effect/vitest";
import { makeStore } from "@zaymonoid/katha";
import { Duration, Effect } from "effect";
import { beforeEach, describe, expect, vi } from "vitest";

vi.mock("../util/storage", () => ({
  listTopos: vi.fn(),
  loadTopo: vi.fn(),
  saveTopo: vi.fn(),
  deleteTopo: vi.fn(),
}));

import * as storage from "../util/storage";
import { initialState, rootProcess, rootReducer, type State } from "./root";
import { emptyTopo } from "./types";

const mocked = vi.mocked(storage);

beforeEach(() => {
  vi.clearAllMocks();
  mocked.listTopos.mockResolvedValue([]);
  mocked.loadTopo.mockResolvedValue(null);
  mocked.saveTopo.mockResolvedValue();
});

// Seed identical to store.ts but deterministic for tests.
const seed = (): State => ({
  ...initialState,
  topo: emptyTopo("test-topo"),
});

describe("store scenarios", () => {
  it.scopedLive(
    "user draws a route, then undoes — content empty, past empty, future has the route",
    () =>
      Effect.gen(function* () {
        const store = yield* makeStore({
          initialState: seed(),
          reduce: rootReducer,
          process: rootProcess,
        });
        // Wait for bootstrap to hydrate
        yield* Effect.sleep(Duration.millis(30));

        yield* store.put({ id: "routes/create", data: { id: "r1" } });
        yield* Effect.sleep(Duration.millis(20));

        let s = yield* store.select();
        expect(s.topo.snapshot.routes.map((r) => r.id)).toEqual(["r1"]);
        expect(s.history.past).toHaveLength(1); // pushed the prior empty state

        yield* store.put({ id: "history/undo" });
        yield* Effect.sleep(Duration.millis(20));

        s = yield* store.select();
        expect(s.topo.snapshot.routes).toEqual([]);
        expect(s.history.past).toEqual([]);
        expect(s.history.future).toHaveLength(1);
      }),
  );

  it.scopedLive("slider drags do NOT pollute history (fk47 regression test)", () =>
    Effect.gen(function* () {
      const store = yield* makeStore({
        initialState: seed(),
        reduce: rootReducer,
        process: rootProcess,
      });
      yield* Effect.sleep(Duration.millis(30));

      // Dispatch a real user edit first so we have a known past depth
      yield* store.put({ id: "routes/create", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(20));
      const pastBefore = (yield* store.select()).history.past.length;

      // Drag the line-width slider 30 times — should not push any history
      for (let i = 0; i < 30; i++) {
        yield* store.put({ id: "display/setLineWidth", data: 1 + i * 0.01 });
      }
      yield* Effect.sleep(Duration.millis(30));

      const s = yield* store.select();
      expect(s.history.past).toHaveLength(pastBefore);
      expect(s.topo.display.lineWidth).toBeCloseTo(1 + 29 * 0.01);
    }),
  );

  it.scopedLive("extend session: cancel reverts to pre-extend snapshot", () =>
    Effect.gen(function* () {
      const store = yield* makeStore({
        initialState: seed(),
        reduce: rootReducer,
        process: rootProcess,
      });
      yield* Effect.sleep(Duration.millis(30));

      // Set up a route to extend
      yield* store.put({ id: "routes/create", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(20));
      yield* store.put({
        id: "points/append",
        data: { routeId: "r1", point: { x: 0.1, y: 0.1 } },
      });
      yield* Effect.sleep(Duration.millis(20));
      const beforeExtend = (yield* store.select()).topo.snapshot;

      // Enter extend session, add another point, then cancel
      yield* store.put({
        id: "mode/enterDrawing",
        data: { routeId: "r1", resumed: true },
      });
      yield* Effect.sleep(Duration.millis(20));
      yield* store.put({
        id: "points/append",
        data: { routeId: "r1", point: { x: 0.5, y: 0.5 } },
      });
      yield* Effect.sleep(Duration.millis(20));
      yield* store.put({ id: "mode/cancelDrawing" });
      yield* Effect.sleep(Duration.millis(20));

      const s = yield* store.select();
      // Content should match the pre-extend snapshot (one point only)
      expect(s.topo.snapshot.routes[0].points).toEqual(beforeExtend.routes[0].points);
    }),
  );

  it.scopedLive("undo after deleting a route restores it via history.past", () =>
    Effect.gen(function* () {
      const store = yield* makeStore({
        initialState: seed(),
        reduce: rootReducer,
        process: rootProcess,
      });
      yield* Effect.sleep(Duration.millis(30));

      yield* store.put({ id: "routes/create", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(20));
      yield* store.put({ id: "routes/create", data: { id: "r2" } });
      yield* Effect.sleep(Duration.millis(20));
      yield* store.put({ id: "routes/delete", data: { id: "r1" } });
      yield* Effect.sleep(Duration.millis(20));
      // modeTransitions process should have ensured we don't have a dangling
      // selection — but more importantly, undo restores r1.
      yield* store.put({ id: "history/undo" });
      yield* Effect.sleep(Duration.millis(20));

      const s = yield* store.select();
      expect(s.topo.snapshot.routes.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
    }),
  );
});
