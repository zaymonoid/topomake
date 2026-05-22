import type { EditorMode } from "./mode";
import type {
  Annotation,
  Image,
  NumberingOrder,
  Point,
  Route,
  RouteColor,
  RouteFinishStyle,
  Snapshot,
  Topo,
} from "./types";

// === Tool ===

export type Tool = "select" | "draw" | "annotate" | "branch";

// === Action union ===
//
// Convention: `<slice>/<verb>`. Data payload is omitted when an action carries
// no data. Reducers are pure — any non-determinism (uuids, timestamps) is
// computed at the dispatch site and carried in the action.

export type Action =
  // --- topo: identity + display + content bulk-replace ---
  | { id: "topo/setName"; data: string }
  | { id: "topo/setImage"; data: Image }
  | { id: "topo/uploadImageRequested"; data: File }
  | { id: "topo/loadFrom"; data: Topo }
  | { id: "topo/new"; data: { id: string } }
  | { id: "topo/replaceContent"; data: Snapshot }

  // --- display ---
  | { id: "display/setLineWidth"; data: number }
  | { id: "display/setNumberSize"; data: number }
  | { id: "display/setNumberingOffset"; data: number }
  | { id: "display/setNumberingOrder"; data: NumberingOrder }

  // --- routes (history-tracked via version bump) ---
  | { id: "routes/create"; data: { id: string } }
  | { id: "routes/delete"; data: { id: string } }
  | { id: "routes/setName"; data: { id: string; name: string } }
  | { id: "routes/setColor"; data: { id: string; color: RouteColor } }
  | { id: "routes/setFinishStyle"; data: { id: string; finishStyle: RouteFinishStyle } }
  | {
      id: "routes/branch";
      data: { id: string; parentRouteId: string; atIndex: number };
    }

  // --- points on routes (history-tracked) ---
  | { id: "points/append"; data: { routeId: string; point: Point } }
  | { id: "points/insert"; data: { routeId: string; index: number; point: Point } }
  | { id: "points/delete"; data: { routeId: string; index: number } }
  | {
      id: "points/setPoint";
      data: { routeId: string; pointIndex: number; point: Point };
    }

  // --- annotations (history-tracked except setPos during drag) ---
  | {
      id: "annotations/create";
      data: { id: string; x: number; y: number; text?: string };
    }
  | { id: "annotations/setText"; data: { id: string; text: string } }
  | { id: "annotations/setColor"; data: { id: string; color: RouteColor } }
  | { id: "annotations/setPos"; data: { id: string; x: number; y: number } }
  | { id: "annotations/delete"; data: { id: string } }

  // --- history ---
  | { id: "history/push"; data: Snapshot }
  | { id: "history/undo" }
  | { id: "history/redo" }
  | { id: "history/clear" }
  | { id: "history/restore"; data: { past: Snapshot[]; future: Snapshot[] } }

  // --- editor: mode + tool + annotation selection ---
  | { id: "mode/selectRoute"; data: { routeId: string } }
  | { id: "mode/deselect" }
  | { id: "mode/enterDrawing"; data: { routeId: string; resumed?: boolean } }
  | { id: "mode/finishDrawing" }
  | { id: "mode/cancelDrawing" }
  | { id: "mode/set"; data: EditorMode } // for low-level mode forcing (rare)
  | { id: "mode/selectAnnotation"; data: { id: string | null } }
  | { id: "tool/set"; data: Tool }

  // --- drag (overlay slice) ---
  | { id: "drag/begin"; data: { routeId: string; pointIndex: number } }
  | {
      id: "drag/setLivePosition";
      data: { routeId: string; pointIndex: number; point: Point } | null;
    }
  | { id: "drag/end" }

  // --- hover (overlay slice) ---
  | { id: "hover/set"; data: { routeId: string; index: number } }
  | { id: "hover/clear" }

  // --- persistence ---
  | { id: "persistence/saveStarted" }
  | { id: "persistence/saveCompleted" }
  | { id: "persistence/saveFailed"; data: { error: string } }
  | { id: "persistence/hydrated" };

// Helper to extract a specific action's payload by id — useful in process bodies
// where katha's combinators bind by id and we want strong typing.
export type ActionOf<I extends Action["id"]> = Extract<Action, { id: I }>;

// Routes/annotations helpers for tests + processes that need to read from a Route
// without importing the types module separately.
export type { Annotation, Route };
