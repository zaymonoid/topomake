import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { keyDown$ } from "use-control/lib/input/keyboard";
import { undoAtom, redoAtom } from "../../state/atoms";
import { canUndoAtom, canRedoAtom } from "../../state/computed";
import { isTypingInField } from "../useFocusGuard";

// Undo/redo need modifier-key inspection, which the `keycode`-based hooks don't expose.
// Subscribe to use-control's raw keyDown$ observable so we get the underlying KeyboardEvent.
export function GlobalShortcuts() {
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);

  useEffect(() => {
    const sub = keyDown$.subscribe((e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "z") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (isTypingInField()) return;
      e.preventDefault();
      if (e.shiftKey) {
        if (canRedo) redo();
      } else if (canUndo) {
        undo();
      }
    });
    return () => sub.unsubscribe();
  }, [undo, redo, canUndo, canRedo]);

  return null;
}
