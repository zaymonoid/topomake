export type EditorMode =
  | { kind: "empty" }
  | { kind: "idle" }
  | { kind: "selected"; routeId: string }
  | { kind: "drawing"; routeId: string }
  | { kind: "dragging"; routeId: string; pointIndex: number };

export const modeRouteId = (m: EditorMode): string | null =>
  m.kind === "selected" || m.kind === "drawing" || m.kind === "dragging" ? m.routeId : null;

export type ShortcutsScope = "global" | "drawing" | "selected";
