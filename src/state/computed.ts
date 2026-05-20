import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import {
  type DragOverride,
  dragOverrideAtom,
  editorModeAtom,
  historyAtom,
  topoAtom,
} from "./atoms";
import type { ShortcutsScope } from "./mode";
import type { Point, Route } from "./types";

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

export const routesAtom = atom((get) => get(topoAtom).routes);

export const annotationsAtom = atom((get) => get(topoAtom).annotations);
export const annotationCountAtom = atom((get) => get(annotationsAtom).length);

export const routeNumberRangeAtom = atom<{ min: number; max: number } | null>((get) => {
  const routes = get(routesAtom).filter((r) => r.branchFrom === undefined);
  if (routes.length === 0) return null;
  const nums = routes.map((r) => r.number);
  return { min: Math.min(...nums), max: Math.max(...nums) };
});

export const imageLoadedAtom = atom((get) => get(topoAtom).image !== null);

export const hasRoutesAtom = atom((get) => get(routesAtom).length > 0);
export const routeCountAtom = atom((get) => get(routesAtom).length);

export const nextRouteNumberAtom = atom((get) => {
  const topo = get(topoAtom);
  const numbered = topo.routes.filter((r) => r.branchFrom === undefined);
  if (numbered.length === 0) return topo.startNumber;
  return Math.max(...numbered.map((r) => r.number)) + 1;
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
  const label = isVariation ? route?.name?.trim() || "Variation" : `Route ${route?.number ?? "?"}`;
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
