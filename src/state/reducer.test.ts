import { describe, expect, it } from "vitest";
import type { Action } from "./actions";
import { initialState, rootReducer, type State } from "./reducer";
import { type Annotation, emptyTopo, type Route, type Snapshot, type Topo } from "./types";

// --- fixtures ---

const route = (id: string, overrides: Partial<Route> = {}): Route => ({
  id,
  name: "",
  color: "blue",
  finishStyle: "circle",
  points: [],
  ...overrides,
});

const annotation = (id: string, overrides: Partial<Annotation> = {}): Annotation => ({
  id,
  text: "",
  x: 0.5,
  y: 0.5,
  ...overrides,
});

const seed = (topo: Partial<Topo> = {}, snapshot: Partial<Snapshot> = {}): State => {
  const base = emptyTopo("t1");
  return {
    ...initialState,
    topo: {
      ...base,
      ...topo,
      snapshot: { ...base.snapshot, ...snapshot },
    },
  };
};

const dispatch = (state: State, action: Action): State => {
  const next = rootReducer(state, action);
  return next ?? state;
};

// --- topo: identity / image / loadFrom / new ---

describe("topo identity actions", () => {
  it("topo/setName updates name", () => {
    const s = dispatch(seed(), { id: "topo/setName", data: "Slate" });
    expect(s.topo.name).toBe("Slate");
  });

  it("topo/setImage assigns image", () => {
    const img = { dataUrl: "data:foo", width: 100, height: 50 };
    const s = dispatch(seed(), { id: "topo/setImage", data: img });
    expect(s.topo.image).toEqual(img);
  });

  it("topo/new resets topo + history", () => {
    const populated = seed({}, { routes: [route("r1")] });
    const s = dispatch(populated, { id: "topo/new", data: { id: "fresh" } });
    expect(s.topo.id).toBe("fresh");
    expect(s.topo.snapshot.routes).toEqual([]);
    expect(s.history.past).toEqual([]);
    expect(s.history.future).toEqual([]);
  });

  it("topo/loadFrom replaces topo wholesale", () => {
    const loaded = emptyTopo("loaded");
    const s = dispatch(seed(), { id: "topo/loadFrom", data: loaded });
    expect(s.topo).toBe(loaded);
  });

  it("topo/replaceContent replaces snapshot", () => {
    const snap: Snapshot = { routes: [route("r1")], annotations: [] };
    const s = dispatch(seed(), { id: "topo/replaceContent", data: snap });
    expect(s.topo.snapshot).toBe(snap);
  });
});

// --- display ---

describe("display actions", () => {
  it("display/setLineWidth updates display", () => {
    const s = dispatch(seed(), { id: "display/setLineWidth", data: 1.7 });
    expect(s.topo.display.lineWidth).toBe(1.7);
  });

  it("display/setNumberSize", () => {
    const s = dispatch(seed(), { id: "display/setNumberSize", data: 1.3 });
    expect(s.topo.display.numberSize).toBe(1.3);
  });

  it("display/setNumberingOffset", () => {
    const s = dispatch(seed(), { id: "display/setNumberingOffset", data: 12 });
    expect(s.topo.display.numbering.startOffset).toBe(12);
  });

  it("display/setNumberingOrder", () => {
    const s = dispatch(seed(), { id: "display/setNumberingOrder", data: "ltr" });
    expect(s.topo.display.numbering.order).toBe("ltr");
  });
});

// --- routes: content-mutating ---

describe("routes actions ", () => {
  it("routes/create appends a new route", () => {
    const s = dispatch(seed(), { id: "routes/create", data: { id: "r1" } });
    expect(s.topo.snapshot.routes).toHaveLength(1);
    expect(s.topo.snapshot.routes[0].id).toBe("r1");
  });

  it("routes/delete removes route", () => {
    const s0 = seed({}, { routes: [route("r1"), route("r2")] });
    const s = dispatch(s0, { id: "routes/delete", data: { id: "r1" } });
    expect(s.topo.snapshot.routes.map((r) => r.id)).toEqual(["r2"]);
  });

  it("routes/delete cascades to orphaned variations", () => {
    const parent = route("p");
    const child = route("c", { branchFrom: { routeId: "p", atIndex: 0 } });
    const grand = route("g", { branchFrom: { routeId: "c", atIndex: 0 } });
    const s0 = seed({}, { routes: [parent, child, grand] });
    const s = dispatch(s0, { id: "routes/delete", data: { id: "p" } });
    expect(s.topo.snapshot.routes).toEqual([]);
  });

  it("routes/setName / setColor / setFinishStyle", () => {
    const s0 = seed({}, { routes: [route("r1")] });
    const s1 = dispatch(s0, { id: "routes/setName", data: { id: "r1", name: "Crux" } });
    expect(s1.topo.snapshot.routes[0].name).toBe("Crux");

    const s2 = dispatch(s1, { id: "routes/setColor", data: { id: "r1", color: "red" } });
    expect(s2.topo.snapshot.routes[0].color).toBe("red");

    const s3 = dispatch(s2, {
      id: "routes/setFinishStyle",
      data: { id: "r1", finishStyle: "arrow" },
    });
    expect(s3.topo.snapshot.routes[0].finishStyle).toBe("arrow");
  });

  it("routes/branch appends a variation rooted at the parent", () => {
    const parent = route("p", {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
    const s0 = seed({}, { routes: [parent] });
    const s = dispatch(s0, {
      id: "routes/branch",
      data: { id: "v1", parentRouteId: "p", atIndex: 1 },
    });
    expect(s.topo.snapshot.routes).toHaveLength(2);
    expect(s.topo.snapshot.routes[1].id).toBe("v1");
    expect(s.topo.snapshot.routes[1].branchFrom).toEqual({ routeId: "p", atIndex: 1 });
    expect(s.topo.snapshot.routes[1].color).toBe("blue"); // inherits parent color
  });

  it("routes/branch on a non-existent parent is a no-op", () => {
    const s0 = seed({}, { routes: [route("p")] });
    const s = dispatch(s0, {
      id: "routes/branch",
      data: { id: "v1", parentRouteId: "missing", atIndex: 0 },
    });
    expect(s.topo.snapshot.routes).toHaveLength(1);
  });
});

// --- points: content-mutating ---

describe("points actions ", () => {
  it("points/append appends to the named route", () => {
    const s0 = seed({}, { routes: [route("r1", { points: [{ x: 0, y: 0 }] })] });
    const p = { x: 1, y: 1 };
    const s = dispatch(s0, { id: "points/append", data: { routeId: "r1", point: p } });
    expect(s.topo.snapshot.routes[0].points).toEqual([{ x: 0, y: 0 }, p]);
  });

  it("points/insert splices at the given index and shifts variation anchors", () => {
    const parent = route("p", {
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ],
    });
    const child = route("c", { branchFrom: { routeId: "p", atIndex: 1 } });
    const s0 = seed({}, { routes: [parent, child] });
    const inserted = { x: 1, y: 1 };
    const s = dispatch(s0, {
      id: "points/insert",
      data: { routeId: "p", index: 1, point: inserted },
    });
    expect(s.topo.snapshot.routes[0].points).toEqual([{ x: 0, y: 0 }, inserted, { x: 2, y: 2 }]);
    // child anchor shifts from 1 → 2
    expect(s.topo.snapshot.routes[1].branchFrom?.atIndex).toBe(2);
  });

  it("points/delete cascades orphan variations whose anchor was removed", () => {
    const parent = route("p", {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
    const child = route("c", { branchFrom: { routeId: "p", atIndex: 1 } });
    const s0 = seed({}, { routes: [parent, child] });
    const s = dispatch(s0, { id: "points/delete", data: { routeId: "p", index: 1 } });
    expect(s.topo.snapshot.routes.map((r) => r.id)).toEqual(["p"]);
  });

  it("points/setPoint updates the single point at index", () => {
    const s0 = seed(
      {},
      {
        routes: [
          route("r1", {
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          }),
        ],
      },
    );
    const moved = { x: 0.5, y: 0.5 };
    const s = dispatch(s0, {
      id: "points/setPoint",
      data: { routeId: "r1", pointIndex: 0, point: moved },
    });
    expect(s.topo.snapshot.routes[0].points[0]).toEqual(moved);
  });
});

// --- annotations ---

describe("annotations actions", () => {
  it("annotations/create appends", () => {
    const s = dispatch(seed(), {
      id: "annotations/create",
      data: { id: "a1", x: 0.1, y: 0.2, text: "tricky" },
    });
    expect(s.topo.snapshot.annotations).toHaveLength(1);
    expect(s.topo.snapshot.annotations[0]).toMatchObject({
      id: "a1",
      x: 0.1,
      y: 0.2,
      text: "tricky",
    });
  });

  it("annotations/setText / setColor", () => {
    const s0 = seed({}, { annotations: [annotation("a1")] });
    const s1 = dispatch(s0, {
      id: "annotations/setText",
      data: { id: "a1", text: "hello" },
    });
    expect(s1.topo.snapshot.annotations[0].text).toBe("hello");

    const s2 = dispatch(s1, {
      id: "annotations/setColor",
      data: { id: "a1", color: "yellow" },
    });
    expect(s2.topo.snapshot.annotations[0].color).toBe("yellow");
  });

  it("annotations/setPos updates position (drag-shaped)", () => {
    const s0 = seed({}, { annotations: [annotation("a1")] });
    const s = dispatch(s0, {
      id: "annotations/setPos",
      data: { id: "a1", x: 0.9, y: 0.8 },
    });
    expect(s.topo.snapshot.annotations[0]).toMatchObject({ x: 0.9, y: 0.8 });
  });

  it("annotations/delete removes", () => {
    const s0 = seed({}, { annotations: [annotation("a1"), annotation("a2")] });
    const s = dispatch(s0, { id: "annotations/delete", data: { id: "a1" } });
    expect(s.topo.snapshot.annotations.map((a) => a.id)).toEqual(["a2"]);
  });
});

// --- history slice (push, clear, restore) ---

describe("history slice", () => {
  it("history/push appends to past and clears future", () => {
    const snap: Snapshot = { routes: [], annotations: [] };
    const s0: State = {
      ...initialState,
      history: { past: [], future: [{ routes: [], annotations: [] }] },
    };
    const s = dispatch(s0, { id: "history/push", data: snap });
    expect(s.history.past).toEqual([snap]);
    expect(s.history.future).toEqual([]);
  });

  it("history/clear empties both stacks", () => {
    const snap: Snapshot = { routes: [], annotations: [] };
    const s0: State = {
      ...initialState,
      history: { past: [snap], future: [snap] },
    };
    const s = dispatch(s0, { id: "history/clear" });
    expect(s.history.past).toEqual([]);
    expect(s.history.future).toEqual([]);
  });

  it("history/restore sets past + future wholesale", () => {
    const a: Snapshot = { routes: [], annotations: [] };
    const b: Snapshot = { routes: [], annotations: [] };
    const s = dispatch(initialState, {
      id: "history/restore",
      data: { past: [a], future: [b] },
    });
    expect(s.history.past).toEqual([a]);
    expect(s.history.future).toEqual([b]);
  });
});

// --- root reducer: cross-slice undo/redo atomicity ---

describe("root reducer undo / redo", () => {
  // Distinct empty snapshots — the assertions check identity (.toBe), so
  // each call returns a fresh instance with no structural difference.
  const v = (_i: number, suffix: Partial<Snapshot> = {}): Snapshot => ({
    routes: [],
    annotations: [],
    ...suffix,
  });

  it("history/undo pops past, pushes current to future, sets content to popped", () => {
    const v1 = v(1);
    const v2 = v(2);
    const v3 = v(3);
    const s0: State = {
      ...initialState,
      topo: { ...emptyTopo("t"), snapshot: v3 },
      history: { past: [v1, v2], future: [] },
    };
    const s = dispatch(s0, { id: "history/undo" });
    expect(s.topo.snapshot).toBe(v2);
    expect(s.history.past).toEqual([v1]);
    expect(s.history.future).toEqual([v3]);
  });

  it("history/undo with empty past is a no-op", () => {
    const v0 = v(0);
    const s0: State = {
      ...initialState,
      topo: { ...emptyTopo("t"), snapshot: v0 },
      history: { past: [], future: [] },
    };
    const s = dispatch(s0, { id: "history/undo" });
    expect(s).toBe(s0);
  });

  it("history/redo pops future, pushes current to past, sets content to popped", () => {
    const v1 = v(1);
    const v2 = v(2);
    const v3 = v(3);
    const s0: State = {
      ...initialState,
      topo: { ...emptyTopo("t"), snapshot: v1 },
      history: { past: [], future: [v2, v3] },
    };
    const s = dispatch(s0, { id: "history/redo" });
    expect(s.topo.snapshot).toBe(v2);
    expect(s.history.past).toEqual([v1]);
    expect(s.history.future).toEqual([v3]);
  });

  it("history/redo with empty future is a no-op", () => {
    const s0: State = {
      ...initialState,
      topo: { ...emptyTopo("t"), snapshot: v(5) },
      history: { past: [], future: [] },
    };
    const s = dispatch(s0, { id: "history/redo" });
    expect(s).toBe(s0);
  });

  it("undo → redo is a round trip", () => {
    const v1 = v(1);
    const v2 = v(2);
    const s0: State = {
      ...initialState,
      topo: { ...emptyTopo("t"), snapshot: v2 },
      history: { past: [v1], future: [] },
    };
    const undone = dispatch(s0, { id: "history/undo" });
    const redone = dispatch(undone, { id: "history/redo" });
    expect(redone.topo.snapshot).toBe(v2);
    expect(redone.history.past).toEqual([v1]);
    expect(redone.history.future).toEqual([]);
  });
});

// --- editor slice ---

describe("editor slice", () => {
  it("mode/selectRoute → selected", () => {
    const s = dispatch(initialState, { id: "mode/selectRoute", data: { routeId: "r1" } });
    expect(s.editor.mode).toEqual({ kind: "selected", routeId: "r1" });
  });

  it("mode/deselect → idle and clears selectedAnnotationId", () => {
    const s0: State = {
      ...initialState,
      editor: {
        mode: { kind: "selected", routeId: "r1" },
        currentTool: "select",
        selectedAnnotationId: "a1",
      },
    };
    const s = dispatch(s0, { id: "mode/deselect" });
    expect(s.editor.mode).toEqual({ kind: "idle" });
    expect(s.editor.selectedAnnotationId).toBe(null);
  });

  it("mode/enterDrawing → drawing(resumed?)", () => {
    const s = dispatch(initialState, {
      id: "mode/enterDrawing",
      data: { routeId: "r1", resumed: true },
    });
    expect(s.editor.mode).toEqual({ kind: "drawing", routeId: "r1", resumed: true });
  });

  it("mode/finishDrawing transitions drawing → selected", () => {
    const s0: State = {
      ...initialState,
      editor: { ...initialState.editor, mode: { kind: "drawing", routeId: "r1" } },
    };
    const s = dispatch(s0, { id: "mode/finishDrawing" });
    expect(s.editor.mode).toEqual({ kind: "selected", routeId: "r1" });
  });

  it("mode/finishDrawing is a no-op outside drawing", () => {
    const s = dispatch(initialState, { id: "mode/finishDrawing" });
    expect(s).toBe(initialState);
  });

  it("tool/set updates currentTool", () => {
    const s = dispatch(initialState, { id: "tool/set", data: "draw" });
    expect(s.editor.currentTool).toBe("draw");
  });

  it("mode/selectAnnotation sets the id", () => {
    const s = dispatch(initialState, {
      id: "mode/selectAnnotation",
      data: { id: "a1" },
    });
    expect(s.editor.selectedAnnotationId).toBe("a1");
  });
});

// --- drag slice ---

describe("drag slice", () => {
  it("drag/begin transitions mode → dragging and clears live position", () => {
    const s0: State = {
      ...initialState,
      drag: { dragLivePosition: { routeId: "r1", pointIndex: 0, point: { x: 1, y: 1 } } },
    };
    const s = dispatch(s0, {
      id: "drag/begin",
      data: { routeId: "r2", pointIndex: 3 },
    });
    expect(s.editor.mode).toEqual({ kind: "dragging", routeId: "r2", pointIndex: 3 });
    expect(s.drag.dragLivePosition).toBe(null);
  });

  it("drag/setLivePosition writes the overlay", () => {
    const data = { routeId: "r1", pointIndex: 0, point: { x: 0.5, y: 0.5 } };
    const s = dispatch(initialState, { id: "drag/setLivePosition", data });
    expect(s.drag.dragLivePosition).toEqual(data);
  });

  it("drag/end transitions mode back to selected (overlay cleared by process, not reducer)", () => {
    const s0: State = {
      ...initialState,
      editor: {
        ...initialState.editor,
        mode: { kind: "dragging", routeId: "r1", pointIndex: 0 },
      },
      drag: { dragLivePosition: { routeId: "r1", pointIndex: 0, point: { x: 1, y: 1 } } },
    };
    const s = dispatch(s0, { id: "drag/end" });
    expect(s.editor.mode).toEqual({ kind: "selected", routeId: "r1" });
    // overlay deliberately preserved at the reducer level — the dragSession
    // process clears it AFTER committing the final point.
    expect(s.drag.dragLivePosition).toEqual({
      routeId: "r1",
      pointIndex: 0,
      point: { x: 1, y: 1 },
    });
  });
});

// --- hover slice ---

describe("hover slice", () => {
  it("hover/set stores the hovered handle", () => {
    const s = dispatch(initialState, {
      id: "hover/set",
      data: { routeId: "r1", index: 2 },
    });
    expect(s.hover.hoveredHandle).toEqual({ routeId: "r1", index: 2 });
  });

  it("hover/clear nulls it", () => {
    const s0: State = {
      ...initialState,
      hover: { hoveredHandle: { routeId: "r1", index: 2 } },
    };
    const s = dispatch(s0, { id: "hover/clear" });
    expect(s.hover.hoveredHandle).toBe(null);
  });

  it("tool/set away from branch clears hover", () => {
    const s0: State = {
      ...initialState,
      hover: { hoveredHandle: { routeId: "r1", index: 0 } },
    };
    const s = dispatch(s0, { id: "tool/set", data: "select" });
    expect(s.hover.hoveredHandle).toBe(null);
  });

  it("tool/set to branch preserves hover (idempotent)", () => {
    const handle = { routeId: "r1", index: 0 };
    const s0: State = { ...initialState, hover: { hoveredHandle: handle } };
    const s = dispatch(s0, { id: "tool/set", data: "branch" });
    expect(s.hover.hoveredHandle).toEqual(handle);
  });
});

// --- persistence slice ---

describe("persistence slice", () => {
  it("saveStarted → saving", () => {
    const s = dispatch(initialState, { id: "persistence/saveStarted" });
    expect(s.persistence.saveStatus).toBe("saving");
  });

  it("saveCompleted → saved", () => {
    const s = dispatch(initialState, { id: "persistence/saveCompleted" });
    expect(s.persistence.saveStatus).toBe("saved");
  });

  it("saveFailed → error", () => {
    const s = dispatch(initialState, {
      id: "persistence/saveFailed",
      data: { error: "oops" },
    });
    expect(s.persistence.saveStatus).toBe("error");
  });

  it("hydrated sets hydrated=true and saved", () => {
    const s = dispatch(initialState, { id: "persistence/hydrated" });
    expect(s.persistence.hydrated).toBe(true);
    expect(s.persistence.saveStatus).toBe("saved");
  });
});
