import { deriveRouteNumbers } from "./derive";
import type { ShortcutsScope } from "./mode";
import type { State } from "./root";
import type { Annotation, Route } from "./types";

// ============================================================================
// Pass-through selectors — return slice refs directly. No work.
// ============================================================================

export const selectTopo = (s: State) => s.topo;
export const selectIdentity = (s: State) => ({ id: s.topo.id, name: s.topo.name });
export const selectImage = (s: State) => s.topo.image;
export const selectDisplay = (s: State) => s.topo.display;
export const selectMetadata = (s: State) => s.topo.metadata;
export const selectMode = (s: State) => s.editor.mode;
export const selectCurrentTool = (s: State) => s.editor.currentTool;
export const selectSelectedAnnotationId = (s: State) => s.editor.selectedAnnotationId;
export const selectHoveredHandle = (s: State) => s.hover.hoveredHandle;
export const selectSaveStatus = (s: State) => s.persistence.saveStatus;
export const selectHydrated = (s: State) => s.persistence.hydrated;

// ============================================================================
// Materialized selectors — apply overlays from side-channel slices (drag).
// Memoized so the same state ref → same output ref (subscription friendly).
// ============================================================================

type DragOverlay = { routeId: string; pointIndex: number; point: Route["points"][number] } | null;

const dragOverlay = (s: State): DragOverlay => {
  const m = s.editor.mode;
  if (m.kind !== "dragging" || m.livePosition === null) return null;
  return { routeId: m.routeId, pointIndex: m.pointIndex, point: m.livePosition };
};

type RoutesCache = {
  routes: Route[];
  mode: State["editor"]["mode"];
  result: Route[];
};
let routesCache: RoutesCache | null = null;

export const selectRoutes = (s: State): Route[] => {
  const routes = s.topo.snapshot.routes;
  const mode = s.editor.mode;
  if (routesCache && routesCache.routes === routes && routesCache.mode === mode) {
    return routesCache.result;
  }
  const drag = dragOverlay(s);
  let result: Route[];
  if (!drag) {
    result = routes;
  } else {
    const targetIdx = routes.findIndex((r) => r.id === drag.routeId);
    if (targetIdx < 0) {
      result = routes;
    } else {
      result = routes.map((r, i) => {
        if (i !== targetIdx) return r;
        const points = r.points.map((p, j) => (j === drag.pointIndex ? drag.point : p));
        return { ...r, points };
      });
    }
  }
  routesCache = { routes, mode, result };
  return result;
};

export const selectRoute = (s: State, id: string): Route | null =>
  selectRoutes(s).find((r) => r.id === id) ?? null;

export const selectAnnotations = (s: State): Annotation[] => s.topo.snapshot.annotations;

export const selectAnnotation = (s: State, id: string): Annotation | null =>
  selectAnnotations(s).find((a) => a.id === id) ?? null;

// ============================================================================
// Derived route numbers — memoized over (routes, numbering) input refs.
// ============================================================================

type NumbersCache = {
  routes: Route[];
  numbering: State["topo"]["display"]["numbering"];
  result: Map<string, number>;
};
let numbersCache: NumbersCache | null = null;

export const selectRouteNumbers = (s: State): Map<string, number> => {
  const routes = s.topo.snapshot.routes;
  const numbering = s.topo.display.numbering;
  if (numbersCache && numbersCache.routes === routes && numbersCache.numbering === numbering) {
    return numbersCache.result;
  }
  const result = deriveRouteNumbers(routes, numbering);
  numbersCache = { routes, numbering, result };
  return result;
};

export const selectRouteNumber = (s: State, id: string): number | null =>
  selectRouteNumbers(s).get(id) ?? null;

export const selectRouteNumberRange = (s: State): { min: number; max: number } | null => {
  const nums = [...selectRouteNumbers(s).values()];
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
};

// ============================================================================
// Mode-derived selectors
// ============================================================================

export const selectSelectedRouteId = (s: State): string | null => {
  const m = s.editor.mode;
  return m.kind === "selected" || m.kind === "drawing" || m.kind === "dragging" ? m.routeId : null;
};

export const selectDrawingRouteId = (s: State): string | null => {
  const m = s.editor.mode;
  return m.kind === "drawing" ? m.routeId : null;
};

export const selectIsDragging = (s: State): boolean => s.editor.mode.kind === "dragging";

export const selectDraggingPointIndex = (s: State): number | null => {
  const m = s.editor.mode;
  return m.kind === "dragging" ? m.pointIndex : null;
};

export const selectCanvasCursor = (s: State): "crosshair" | "grabbing" | "default" => {
  const m = s.editor.mode;
  if (m.kind === "drawing") return "crosshair";
  if (m.kind === "dragging") return "grabbing";
  return "default";
};

export const selectShortcutsScope = (s: State): ShortcutsScope | null => {
  const m = s.editor.mode;
  if (m.kind === "drawing") return "drawing";
  if (m.kind === "selected") return "selected";
  return null;
};

// ============================================================================
// Cross-cutting derivations
// ============================================================================

export const selectImageLoaded = (s: State): boolean => s.topo.image !== null;
export const selectExportable = (s: State): boolean => selectImageLoaded(s);
export const selectHasRoutes = (s: State): boolean => s.topo.snapshot.routes.length > 0;
export const selectRouteCount = (s: State): number => s.topo.snapshot.routes.length;
export const selectAnnotationCount = (s: State): number => s.topo.snapshot.annotations.length;

export const selectCanAddRoute = (s: State): boolean =>
  selectImageLoaded(s) && s.editor.mode.kind !== "drawing";

export const selectCanUndo = (s: State): boolean => s.history.past.length > 0;
export const selectCanRedo = (s: State): boolean => s.history.future.length > 0;

export const selectCurrentRoute = (s: State): Route | null => {
  const id = selectSelectedRouteId(s);
  if (id === null) return null;
  return selectRoute(s, id);
};

export type ModeHint = { title: string; hints: string[] };

export const selectModeHint = (s: State): ModeHint | null => {
  const m = s.editor.mode;
  if (m.kind === "empty") return { title: "Upload an image to begin", hints: [] };
  if (m.kind === "idle") return null;
  if (m.kind === "dragging") return null;
  const route = selectCurrentRoute(s);
  const isVariation = route?.branchFrom !== undefined;
  const number = route ? (selectRouteNumbers(s).get(route.id) ?? null) : null;
  const label = isVariation ? route?.name?.trim() || "Variation" : `Route ${number ?? "?"}`;
  if (m.kind === "drawing") {
    if (m.resumed) {
      return {
        title: `Extending ${label}`,
        hints: ["click to place", "Enter to finish", "Esc to revert"],
      };
    }
    return {
      title: `Drawing ${label}`,
      hints: ["click to place", "Enter or Esc to finish"],
    };
  }
  return {
    title: label,
    hints: ["drag handles", "click line to insert", "⌫ to delete", "Enter or Esc to deselect"],
  };
};
