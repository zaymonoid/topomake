import { describe, expect, it } from "vitest";
import { initialState, type State } from "./root";
import {
  selectAnnotationCount,
  selectAnnotations,
  selectCanAddRoute,
  selectCanRedo,
  selectCanUndo,
  selectCanvasCursor,
  selectCurrentRoute,
  selectCurrentTool,
  selectDisplay,
  selectDraggingPointIndex,
  selectDrawingRouteId,
  selectHasRoutes,
  selectHoveredHandle,
  selectImageLoaded,
  selectIsDragging,
  selectMode,
  selectRoute,
  selectRouteCount,
  selectRouteNumber,
  selectRouteNumberRange,
  selectRouteNumbers,
  selectRoutes,
  selectSelectedRouteId,
  selectShortcutsScope,
} from "./selectors";
import { emptyTopo, type Route } from "./types";

const route = (id: string, overrides: Partial<Route> = {}): Route => ({
  id,
  name: "",
  color: "blue",
  finishStyle: "circle",
  points: [],
  ...overrides,
});

const seedWith = (mut: (s: State) => State): State => mut({ ...initialState });

describe("pass-through selectors", () => {
  it("selectDisplay returns the display slice", () => {
    expect(selectDisplay(initialState)).toBe(initialState.topo.display);
  });

  it("selectMode / selectCurrentTool", () => {
    const s = seedWith((x) => ({
      ...x,
      editor: { ...x.editor, mode: { kind: "idle" }, currentTool: "draw" },
    }));
    expect(selectMode(s)).toEqual({ kind: "idle" });
    expect(selectCurrentTool(s)).toBe("draw");
  });

  it("selectHoveredHandle", () => {
    const s = seedWith((x) => ({
      ...x,
      hover: { hoveredHandle: { routeId: "r1", index: 0 } },
    }));
    expect(selectHoveredHandle(s)).toEqual({ routeId: "r1", index: 0 });
  });
});

describe("materialized selectRoutes (drag overlay)", () => {
  it("returns committed routes unchanged when no drag", () => {
    const routes = [route("r1", { points: [{ x: 0, y: 0 }] })];
    const s = seedWith((x) => ({
      ...x,
      topo: { ...x.topo, snapshot: { ...x.topo.snapshot, routes } },
    }));
    expect(selectRoutes(s)).toEqual(routes);
  });

  it("applies live drag overlay (from mode.dragging) to the targeted point", () => {
    const routes = [
      route("r1", {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      }),
      route("r2", { points: [{ x: 2, y: 2 }] }),
    ];
    const s = seedWith((x) => ({
      ...x,
      topo: { ...x.topo, snapshot: { ...x.topo.snapshot, routes } },
      editor: {
        ...x.editor,
        mode: {
          kind: "dragging",
          routeId: "r1",
          pointIndex: 1,
          livePosition: { x: 5, y: 5 },
        },
      },
    }));
    const materialized = selectRoutes(s);
    expect(materialized[0].points[1]).toEqual({ x: 5, y: 5 });
    expect(materialized[0].points[0]).toEqual({ x: 0, y: 0 });
    expect(materialized[1]).toBe(routes[1]);
  });

  it("ignores drag overlay targeting a non-existent route", () => {
    const routes = [route("r1", { points: [{ x: 0, y: 0 }] })];
    const s = seedWith((x) => ({
      ...x,
      topo: { ...x.topo, snapshot: { ...x.topo.snapshot, routes } },
      editor: {
        ...x.editor,
        mode: {
          kind: "dragging",
          routeId: "ghost",
          pointIndex: 0,
          livePosition: { x: 9, y: 9 },
        },
      },
    }));
    expect(selectRoutes(s)).toEqual(routes);
  });

  it("selectRoute(id) returns null when missing, materialized when present", () => {
    const r1 = route("r1", { points: [{ x: 0, y: 0 }] });
    const s = seedWith((x) => ({
      ...x,
      topo: { ...x.topo, snapshot: { ...x.topo.snapshot, routes: [r1] } },
      editor: {
        ...x.editor,
        mode: {
          kind: "dragging",
          routeId: "r1",
          pointIndex: 0,
          livePosition: { x: 0.5, y: 0.5 },
        },
      },
    }));
    expect(selectRoute(s, "missing")).toBe(null);
    const materialized = selectRoute(s, "r1");
    expect(materialized?.points[0]).toEqual({ x: 0.5, y: 0.5 });
  });

  it("memoizes: same input → same output reference", () => {
    const routes = [route("r1", { points: [{ x: 0, y: 0 }] })];
    const s = seedWith((x) => ({
      ...x,
      topo: { ...x.topo, snapshot: { ...x.topo.snapshot, routes } },
    }));
    expect(selectRoutes(s)).toBe(selectRoutes(s));
  });
});

describe("route numbers (derived)", () => {
  it("selectRouteNumbers respects offset", () => {
    const routes = [
      route("a", { points: [{ x: 0.1, y: 0 }] }),
      route("b", { points: [{ x: 0.5, y: 0 }] }),
    ];
    const s = seedWith((x) => ({
      ...x,
      topo: {
        ...x.topo,
        display: {
          ...x.topo.display,
          numbering: { startOffset: 10, order: "created" },
        },
        snapshot: { ...x.topo.snapshot, routes },
      },
    }));
    const nums = selectRouteNumbers(s);
    expect(nums.get("a")).toBe(10);
    expect(nums.get("b")).toBe(11);
  });

  it("ltr order sorts by start.x", () => {
    const routes = [
      route("a", { points: [{ x: 0.7, y: 0 }] }),
      route("b", { points: [{ x: 0.2, y: 0 }] }),
    ];
    const s = seedWith((x) => ({
      ...x,
      topo: {
        ...x.topo,
        display: {
          ...x.topo.display,
          numbering: { startOffset: 1, order: "ltr" },
        },
        snapshot: { ...x.topo.snapshot, routes },
      },
    }));
    const nums = selectRouteNumbers(s);
    expect(nums.get("b")).toBe(1);
    expect(nums.get("a")).toBe(2);
  });

  it("variations get no number", () => {
    const routes = [
      route("p", { points: [{ x: 0, y: 0 }] }),
      route("v", { branchFrom: { routeId: "p", atIndex: 0 } }),
    ];
    const s = seedWith((x) => ({
      ...x,
      topo: { ...x.topo, snapshot: { ...x.topo.snapshot, routes } },
    }));
    const nums = selectRouteNumbers(s);
    expect(nums.has("v")).toBe(false);
    expect(selectRouteNumber(s, "v")).toBe(null);
  });

  it("selectRouteNumberRange null when empty, else { min, max }", () => {
    expect(selectRouteNumberRange(initialState)).toBe(null);
    const routes = [
      route("a", { points: [{ x: 0.1, y: 0 }] }),
      route("b", { points: [{ x: 0.5, y: 0 }] }),
      route("c", { points: [{ x: 0.9, y: 0 }] }),
    ];
    const s = seedWith((x) => ({
      ...x,
      topo: {
        ...x.topo,
        display: {
          ...x.topo.display,
          numbering: { startOffset: 5, order: "created" },
        },
        snapshot: { ...x.topo.snapshot, routes },
      },
    }));
    expect(selectRouteNumberRange(s)).toEqual({ min: 5, max: 7 });
  });
});

describe("mode-derived selectors", () => {
  const inMode = (mode: State["editor"]["mode"]): State =>
    seedWith((x) => ({ ...x, editor: { ...x.editor, mode } }));

  it("selectSelectedRouteId across kinds", () => {
    expect(selectSelectedRouteId(inMode({ kind: "empty" }))).toBe(null);
    expect(selectSelectedRouteId(inMode({ kind: "idle" }))).toBe(null);
    expect(selectSelectedRouteId(inMode({ kind: "selected", routeId: "r1" }))).toBe("r1");
    expect(selectSelectedRouteId(inMode({ kind: "drawing", routeId: "r2" }))).toBe("r2");
    expect(
      selectSelectedRouteId(
        inMode({ kind: "dragging", routeId: "r3", pointIndex: 0, livePosition: null }),
      ),
    ).toBe("r3");
  });

  it("selectDrawingRouteId is set only in drawing mode", () => {
    expect(selectDrawingRouteId(inMode({ kind: "drawing", routeId: "r2" }))).toBe("r2");
    expect(selectDrawingRouteId(inMode({ kind: "selected", routeId: "r2" }))).toBe(null);
  });

  it("selectIsDragging + selectDraggingPointIndex", () => {
    const drag = inMode({ kind: "dragging", routeId: "r", pointIndex: 4, livePosition: null });
    expect(selectIsDragging(drag)).toBe(true);
    expect(selectDraggingPointIndex(drag)).toBe(4);
    expect(selectIsDragging(inMode({ kind: "idle" }))).toBe(false);
  });

  it("selectCanvasCursor reflects mode", () => {
    expect(selectCanvasCursor(inMode({ kind: "drawing", routeId: "r" }))).toBe("crosshair");
    expect(
      selectCanvasCursor(
        inMode({ kind: "dragging", routeId: "r", pointIndex: 0, livePosition: null }),
      ),
    ).toBe("grabbing");
    expect(selectCanvasCursor(inMode({ kind: "idle" }))).toBe("default");
  });

  it("selectShortcutsScope", () => {
    expect(selectShortcutsScope(inMode({ kind: "drawing", routeId: "r" }))).toBe("drawing");
    expect(selectShortcutsScope(inMode({ kind: "selected", routeId: "r" }))).toBe("selected");
    expect(selectShortcutsScope(inMode({ kind: "idle" }))).toBe(null);
  });
});

describe("misc derived", () => {
  it("selectImageLoaded reflects topo.image", () => {
    expect(selectImageLoaded(initialState)).toBe(false);
    const s = seedWith((x) => ({
      ...x,
      topo: {
        ...x.topo,
        image: { dataUrl: "d", width: 1, height: 1 },
      },
    }));
    expect(selectImageLoaded(s)).toBe(true);
  });

  it("selectCanAddRoute requires image loaded and not drawing", () => {
    const withImage = seedWith((x) => ({
      ...x,
      topo: { ...emptyTopo("t"), image: { dataUrl: "d", width: 1, height: 1 } },
    }));
    expect(selectCanAddRoute(withImage)).toBe(true);
    const drawing = seedWith((x) => ({
      ...withImage,
      editor: { ...x.editor, mode: { kind: "drawing", routeId: "r1" } },
    }));
    expect(selectCanAddRoute(drawing)).toBe(false);
  });

  it("selectHasRoutes / selectRouteCount / selectAnnotationCount", () => {
    const routes = [route("a"), route("b")];
    const s = seedWith((x) => ({
      ...x,
      topo: { ...x.topo, snapshot: { ...x.topo.snapshot, routes } },
    }));
    expect(selectHasRoutes(s)).toBe(true);
    expect(selectRouteCount(s)).toBe(2);
    expect(selectAnnotationCount(initialState)).toBe(0);
  });

  it("selectCanUndo / selectCanRedo", () => {
    expect(selectCanUndo(initialState)).toBe(false);
    expect(selectCanRedo(initialState)).toBe(false);
    const snap = { routes: [], annotations: [] };
    const withPast = seedWith((x) => ({ ...x, history: { past: [snap], future: [] } }));
    expect(selectCanUndo(withPast)).toBe(true);
    const withFuture = seedWith((x) => ({
      ...x,
      history: { past: [], future: [snap] },
    }));
    expect(selectCanRedo(withFuture)).toBe(true);
  });

  it("selectCurrentRoute returns null when nothing selected, materialized when selected", () => {
    expect(selectCurrentRoute(initialState)).toBe(null);
    const r1 = route("r1", { points: [{ x: 0, y: 0 }] });
    const s = seedWith((x) => ({
      ...x,
      editor: {
        ...x.editor,
        mode: {
          kind: "dragging",
          routeId: "r1",
          pointIndex: 0,
          livePosition: { x: 0.7, y: 0.7 },
        },
      },
      topo: { ...x.topo, snapshot: { ...x.topo.snapshot, routes: [r1] } },
    }));
    expect(selectCurrentRoute(s)?.points[0]).toEqual({ x: 0.7, y: 0.7 });
  });

  it("selectAnnotations is a pass-through", () => {
    const s = seedWith((x) => ({
      ...x,
      topo: {
        ...x.topo,
        snapshot: {
          ...x.topo.snapshot,
          annotations: [{ id: "a", text: "x", x: 0.1, y: 0.1 }],
        },
      },
    }));
    expect(selectAnnotations(s)).toBe(s.topo.snapshot.annotations);
  });
});
