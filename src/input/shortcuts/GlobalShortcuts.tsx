import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { keyDown$ } from "use-control/lib/input/keyboard";
import { undoAtom, redoAtom, currentToolAtom } from "../../state/atoms";
import { canAddRouteAtom, canRedoAtom, canUndoAtom, imageLoadedAtom } from "../../state/computed";
import { createRouteAtom, deselectAtom } from "../../state/actions";
import { isTypingInField } from "../useFocusGuard";

// Undo/redo need modifier-key inspection, which the `keycode`-based hooks don't expose.
// Subscribe to use-control's raw keyDown$ observable so we get the underlying KeyboardEvent.
export function GlobalShortcuts() {
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const setTool = useSetAtom(currentToolAtom);
  const createRoute = useSetAtom(createRouteAtom);
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
      if (key === "z" && (e.metaKey || e.ctrlKey)) {
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

      if (key === "v") {
        e.preventDefault();
        setTool("select");
        deselect();
      } else if (key === "r") {
        e.preventDefault();
        setTool("draw");
        if (canAddRoute) createRoute();
      } else if (key === "t") {
        e.preventDefault();
        setTool("annotate");
      }
    });
    return () => sub.unsubscribe();
  }, [undo, redo, canUndo, canRedo, canAddRoute, imageLoaded, setTool, createRoute, deselect]);

  return null;
}
