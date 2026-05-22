import type { NumberingOrder, Point, Route } from "./types";

// For a variation, prepend the parent's anchor point so the rendered polyline
// runs from the anchor through the variation's divergent points. For a
// non-variation (or an orphan whose parent vanished), returns the route's own
// points unchanged.
export function effectivePoints(route: Route, byId: Map<string, Route>): Point[] {
  if (!route.branchFrom) return route.points;
  const parent = byId.get(route.branchFrom.routeId);
  if (!parent) return route.points;
  const anchor = parent.points[route.branchFrom.atIndex];
  if (!anchor) return route.points;
  return [anchor, ...route.points];
}

// Stable spatial sort of numberable routes. Routes without points keep their
// creation order at the end of the sequence (no spatial anchor to compare).
function orderNumberableRoutes(routes: Route[], order: NumberingOrder): Route[] {
  const numberable = routes.filter((r) => r.branchFrom === undefined);
  if (order === "created") return numberable;
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

/**
 * Derive the label-per-route map from a routes list + numbering settings.
 * Variations are absent from the result.
 *
 * Pure function — usable from both the legacy Jotai computed atoms (during
 * the katha migration) and the katha selector layer + non-atom callers
 * (exporters).
 */
export function deriveRouteNumbers(
  routes: Route[],
  numbering: { startOffset: number; order: NumberingOrder },
): Map<string, number> {
  const ordered = orderNumberableRoutes(routes, numbering.order);
  return new Map(ordered.map((r, i) => [r.id, numbering.startOffset + i]));
}
