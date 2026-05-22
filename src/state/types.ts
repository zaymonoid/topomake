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

// Route numbers are NOT stored — they're derived at render time from
// display.numbering + position in routes[]. See routeNumbersAtom.
export type Route = {
  id: string;
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

export type Display = {
  lineWidth: number; // multiplier on rendered route stroke widths (default 1)
  numberSize: number; // multiplier on rendered route number chip size/font (default 1)
  numbering: {
    startOffset: number; // first numbered route gets this label
    order: NumberingOrder;
  };
};

export type Metadata = {
  updatedAt: number;
};

// The subset of Topo that participates in undo/redo: editable content only.
export type Snapshot = {
  routes: Route[];
  annotations: Annotation[];
};

export type Topo = {
  id: string;
  name: string;
  image: Image | null;
  display: Display;
  metadata: Metadata;
  snapshot: Snapshot;
};

export const emptyTopo = (id: string): Topo => ({
  id,
  name: "Untitled Topo",
  image: null,
  display: {
    lineWidth: 1,
    numberSize: 1,
    numbering: { startOffset: 1, order: "created" },
  },
  metadata: { updatedAt: Date.now() },
  snapshot: { routes: [], annotations: [] },
});
