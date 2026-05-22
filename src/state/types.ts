export type Point = { x: number; y: number }; // normalized 0..1 in image space

export type RouteColor = "blue" | "white" | "red" | "yellow";

export const PALETTE: Record<RouteColor, string> = {
  blue: "#2563eb",
  white: "#ffffff",
  red: "#dc2626",
  yellow: "#eab308",
};

export type RouteFinishStyle = "circle" | "arrow";

export type NumberingOrder = "created" | "ltr" | "rtl";

export type BranchAnchor = { routeId: string; atIndex: number };

export type Route = {
  id: string;
  number: number;
  name: string;
  color: RouteColor;
  finishStyle: RouteFinishStyle;
  points: Point[]; // first = start, last = end, middle = intermediate control points
  // When set, this route is a variation: it branches off `routeId` at the parent's
  // points[atIndex]. `points[]` holds only the divergent points — the anchor is
  // prepended at render time so the variation stays attached if the parent moves.
  branchFrom?: BranchAnchor;
};

export type Annotation = {
  id: string;
  text: string;
  x: number; // normalized 0..1
  y: number;
  color?: RouteColor;
};

export type Image = { dataUrl: string; width: number; height: number };

export type Topo = {
  id: string;
  name: string;
  image: Image | null;
  // History-tracked fields (see Snapshot below):
  startNumber: number;
  numberingOrder: NumberingOrder;
  lineWidth: number; // multiplier on rendered route stroke widths (default 1)
  numberSize: number; // multiplier on rendered route number chip size/font (default 1)
  routes: Route[];
  annotations: Annotation[];
};

// The subset of Topo that participates in undo/redo.
// lineWidth / numberSize are display prefs — not history-tracked.
export type Snapshot = Pick<Topo, "startNumber" | "numberingOrder" | "routes" | "annotations">;

export const emptyTopo = (id: string): Topo => ({
  id,
  name: "Untitled Topo",
  image: null,
  startNumber: 1,
  numberingOrder: "created",
  lineWidth: 1,
  numberSize: 1,
  routes: [],
  annotations: [],
});
