export type Point = { x: number; y: number }; // normalized 0..1 in image space

export type RouteColor = "blue" | "white" | "red" | "yellow";

export const PALETTE: Record<RouteColor, string> = {
  blue: "#2563eb",
  white: "#ffffff",
  red: "#dc2626",
  yellow: "#eab308",
};

export type Route = {
  id: string;
  number: number;
  name: string;
  color: RouteColor;
  points: Point[]; // first = start, last = end, middle = intermediate control points
};

export type Topo = {
  name: string;
  imageDataUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  startNumber: number;
  showBanner: boolean;
  routes: Route[];
};

export const emptyTopo = (): Topo => ({
  name: "Untitled Topo",
  imageDataUrl: null,
  imageWidth: 0,
  imageHeight: 0,
  startNumber: 1,
  showBanner: true,
  routes: [],
});
