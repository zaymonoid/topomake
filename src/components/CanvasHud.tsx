import { useAtomValue } from "jotai";
import { editorModeAtom } from "../state/atoms";
import { currentRouteAtom } from "../state/computed";

export function CanvasHud() {
  const route = useAtomValue(currentRouteAtom);
  const mode = useAtomValue(editorModeAtom);

  if (!route) return null;

  const isDrawing = mode.kind === "drawing";

  return (
    <div className="canvas-hud top">
      <div className="hud-chip">
        <span className="dot" />
        <span>{isDrawing ? `Drawing #${route.number}` : `Route #${route.number} selected`}</span>
        <span className="mono">{route.points.length} pts</span>
      </div>
      {!isDrawing && (
        <div className="hud-chip">
          <span style={{ opacity: 0.7 }}>↺ Click line to insert · drag handle to move · ⌫ delete</span>
        </div>
      )}
      {isDrawing && (
        <div className="hud-chip">
          <span style={{ opacity: 0.7 }}>Click to place point · Enter to finish · Esc to cancel</span>
        </div>
      )}
    </div>
  );
}
