import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { keyDown$ } from "use-control/lib/input/keyboard";
import { undoAtom, redoAtom, currentToolAtom, editorModeAtom } from "../../state/atoms";
import { canAddRouteAtom, canRedoAtom, canUndoAtom, imageLoadedAtom } from "../../state/computed";
import { createRouteAtom, deselectAtom, extendRouteAtom } from "../../state/actions";
import { isTypingInField } from "../useFocusGuard";
import { SHORTCUTS } from "../shortcuts";

// Undo/redo need modifier-key inspection, which the `keycode`-based hooks don't expose.
// Subscribe to use-control's raw keyDown$ observable so we get the underlying KeyboardEvent.
export function GlobalShortcuts() {
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const setTool = useSetAtom(currentToolAtom);
  const createRoute = useSetAtom(createRouteAtom);
  const extendRoute = useSetAtom(extendRouteAtom);
  const editorMode = useAtomValue(editorModeAtom);
  const deselect = useSetAtom(deselectAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  const canAddRoute = useAtomValue(canAddRouteAtom);
  const imageLoaded = useAtomValue(imageLoadedAtom);

  useEffect(() => {
    const sub = keyDown$.subscribe((e: KeyboardEvent) => {
      if (isTypingInField()) return;
      const key = e.key.toLowerCase();

      // Undo / redo
      if (key === SHORTCUTS.undo.key && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo();
        } else if (canUndo) {
          undo();
        }
        return;
      }

      // Tool shortcuts — only when no modifier
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!imageLoaded) return;

      if (key === SHORTCUTS.select.key) {
        e.preventDefault();
        setTool("select");
        deselect();
      } else if (key === SHORTCUTS.draw.key) {
        e.preventDefault();
        setTool("draw");
        // Contextual: extend the selected route, else create a new one.
        if (editorMode.kind === "selected") {
          extendRoute(editorMode.routeId);
        } else if (canAddRoute) {
          createRoute();
        }
      } else if (key === SHORTCUTS.annotate.key) {
        e.preventDefault();
        setTool("annotate");
      } else if (key === SHORTCUTS.branch.key) {
        e.preventDefault();
        setTool("branch");
      }
    });
    return () => sub.unsubscribe();
  }, [undo, redo, canUndo, canRedo, canAddRoute, imageLoaded, setTool, createRoute, deselect, extendRoute, editorMode]);

  return null;
}
