import type { Point } from "./types";

export type EditorMode =
  | { kind: "empty" }
  | { kind: "idle" }
  | { kind: "selected"; routeId: string }
  | { kind: "drawing"; routeId: string; resumed?: boolean }
  | {
      kind: "dragging";
      routeId: string;
      pointIndex: number;
      livePosition: Point | null;
    };

export const modeRouteId = (m: EditorMode): string | null =>
  m.kind === "selected" || m.kind === "drawing" || m.kind === "dragging" ? m.routeId : null;

export type ShortcutsScope = "global" | "drawing" | "selected";
