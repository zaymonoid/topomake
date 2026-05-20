export type Point = { x: number; y: number }; // normalized 0..1 in image space

export type RouteColor = "blue" | "white" | "red" | "yellow";

export const PALETTE: Record<RouteColor, string> = {
  blue: "#2563eb",
  white: "#ffffff",
  red: "#dc2626",
  yellow: "#eab308",
};

export type RouteFinishStyle = "circle" | "arrow";

export type Route = {
  id: string;
  number: number;
  name: string;
  color: RouteColor;
  finishStyle: RouteFinishStyle;
  points: Point[]; // first = start, last = end, middle = intermediate control points
};

export type Annotation = {
  id: string;
  text: string;
  x: number; // normalized 0..1
  y: number;
};

export type Image = { dataUrl: string; width: number; height: number };

export type Topo = {
  id: string;
  name: string;
  image: Image | null;
  // History-tracked fields (see Snapshot below):
  startNumber: number;
  routes: Route[];
  annotations: Annotation[];
};

// The subset of Topo that participates in undo/redo.
export type Snapshot = Pick<Topo, "startNumber" | "routes" | "annotations">;

export const emptyTopo = (id: string): Topo => ({
  id,
  name: "Untitled Topo",
  image: null,
  startNumber: 1,
  routes: [],
  annotations: [],
});
