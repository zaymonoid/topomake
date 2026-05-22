import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import {
  contentAtom,
  type DragOverride,
  displayAtom,
  dragOverrideAtom,
  editorModeAtom,
  historyAtom,
  topoAtom,
} from "./atoms";
import type { ShortcutsScope } from "./mode";
import type { NumberingOrder, Point, Route } from "./types";

// For a variation, prepend the parent's anchor point so the rendered polyline
// runs from the anchor through the variation's divergent points. For a non-variation
// (or an orphan whose parent vanished), returns the route's own points unchanged.
export function effectivePoints(route: Route, byId: Map<string, Route>): Point[] {
  if (!route.branchFrom) return route.points;
  const parent = byId.get(route.branchFrom.routeId);
  if (!parent) return route.points;
  const anchor = parent.points[route.branchFrom.atIndex];
  if (!anchor) return route.points;
  return [anchor, ...route.points];
}

// === From topoAtom ===

export const routesAtom = atom((get) => get(contentAtom).routes);

export const annotationsAtom = atom((get) => get(contentAtom).annotations);
export const annotationCountAtom = atom((get) => get(annotationsAtom).length);

export const imageLoadedAtom = atom((get) => get(topoAtom).image !== null);

export const hasRoutesAtom = atom((get) => get(routesAtom).length > 0);
export const routeCountAtom = atom((get) => get(routesAtom).length);

// === Derived route numbers ===
//
// Route numbers are NOT stored. They're derived from the display.numbering
// settings + the route's position. Variations (branchFrom set) get no number.

function orderNumberableRoutes(routes: Route[], order: NumberingOrder): Route[] {
  const numberable = routes.filter((r) => r.branchFrom === undefined);
  if (order === "created") return numberable;
  // Spatial: sort by start.x. Routes without points keep their creation order
  // at the end of the sequence (no spatial anchor to compare).
  const decorated = numberable.map((r, i) => ({ r, i }));
  const withPoints = decorated.filter((d) => d.r.points.length > 0);
  const withoutPoints = decorated.filter((d) => d.r.points.length === 0);
  withPoints.sort((a, b) => {
    const dx = a.r.points[0].x - b.r.points[0].x;
    if (dx !== 0) return order === "ltr" ? dx : -dx;
    return a.i - b.i;
  });
  return [...withPoints, ...withoutPoints].map((d) => d.r);
}

// Pure: derive the label-per-route map from routes + numbering settings.
// Exported for non-atom callers (e.g. exporters) that work over a Topo value.
export function deriveRouteNumbers(
  routes: Route[],
  numbering: { startOffset: number; order: NumberingOrder },
): Map<string, number> {
  const ordered = orderNumberableRoutes(routes, numbering.order);
  return new Map(ordered.map((r, i) => [r.id, numbering.startOffset + i]));
}

// Map from route id → derived number. Variations are absent from the map.
export const routeNumbersAtom = atom((get): Map<string, number> => {
  const routes = get(routesAtom);
  const { numbering } = get(displayAtom);
  return deriveRouteNumbers(routes, numbering);
});

// Per-route slice so a route only re-renders when *its* derived number changes.
export const routeNumberAtomFamily = atomFamily((id: string) =>
  atom((get) => get(routeNumbersAtom).get(id) ?? null),
);

export const routeNumberRangeAtom = atom<{ min: number; max: number } | null>((get) => {
  const nums = [...get(routeNumbersAtom).values()];
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
});

export const exportableAtom = atom((get) => get(imageLoadedAtom));

// === From editorModeAtom ===

export const selectedRouteIdAtom = atom((get) => {
  const m = get(editorModeAtom);
  return m.kind === "selected" || m.kind === "drawing" || m.kind === "dragging" ? m.routeId : null;
});

export const drawingRouteIdAtom = atom((get) => {
  const m = get(editorModeAtom);
  return m.kind === "drawing" ? m.routeId : null;
});

export const isDraggingAtom = atom((get) => get(editorModeAtom).kind === "dragging");

export const draggingPointIndexAtom = atom((get) => {
  const m = get(editorModeAtom);
  return m.kind === "dragging" ? m.pointIndex : null;
});

export const canAddRouteAtom = atom(
  (get) => get(imageLoadedAtom) && get(editorModeAtom).kind !== "drawing",
);

export const canvasCursorAtom = atom((get) => {
  const m = get(editorModeAtom);
  if (m.kind === "drawing") return "crosshair";
  if (m.kind === "dragging") return "grabbing";
  return "default";
});

export const shortcutsScopeAtom = atom<ShortcutsScope | null>((get) => {
  const m = get(editorModeAtom);
  if (m.kind === "drawing") return "drawing";
  if (m.kind === "selected") return "selected";
  return null; // global shortcuts are always mounted separately
});

// === From historyAtom ===

export const canUndoAtom = atom((get) => get(historyAtom).past.length > 0);
export const canRedoAtom = atom((get) => get(historyAtom).future.length > 0);

// === Cross-cutting derivations ===

export const currentRouteAtom = atom<Route | null>((get) => {
  const id = get(selectedRouteIdAtom);
  if (id === null) return null;
  return get(routesAtom).find((r) => r.id === id) ?? null;
});

export type ModeHint = { title: string; hints: string[] };

export const modeHintAtom = atom<ModeHint | null>((get) => {
  const m = get(editorModeAtom);
  if (m.kind === "empty") return { title: "Upload an image to begin", hints: [] };
  if (m.kind === "idle") return null;
  if (m.kind === "dragging") return null;
  const route = get(currentRouteAtom);
  const isVariation = route?.branchFrom !== undefined;
  const number = route ? (get(routeNumbersAtom).get(route.id) ?? null) : null;
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
  // selected
  return {
    title: label,
    hints: ["drag handles", "click line to insert", "⌫ to delete", "Enter or Esc to deselect"],
  };
});

// === Per-route families — each route only invalidates its own derivations ===

export const routeAtomFamily = atomFamily((id: string) =>
  atom<Route | null>((get) => get(routesAtom).find((r) => r.id === id) ?? null),
);

// Returns the drag override only if it targets this route, otherwise null.
// Per-route slicing means non-dragged routes don't re-render when the override updates.
export const dragOverrideForRouteAtomFamily = atomFamily((id: string) =>
  atom<DragOverride>((get) => {
    const o = get(dragOverrideAtom);
    return o && o.routeId === id ? o : null;
  }),
);
