import { useSelector } from "@zaymonoid/katha/react";
import { useEffect } from "react";
import { keyDown$ } from "use-control/lib/input/keyboard";
import {
  selectCanAddRoute,
  selectCanRedo,
  selectCanUndo,
  selectImageLoaded,
  selectMode,
} from "../../state/selectors";
import { store } from "../../state/store";
import { uid } from "../../util/id";
import { SHORTCUTS } from "../shortcuts";
import { isTypingInField } from "../useFocusGuard";

// Undo/redo need modifier-key inspection, which the `keycode`-based hooks don't expose.
// Subscribe to use-control's raw keyDown$ observable so we get the underlying KeyboardEvent.
export function GlobalShortcuts() {
  const editorMode = useSelector(store, selectMode);
  const canUndo = useSelector(store, selectCanUndo);
  const canRedo = useSelector(store, selectCanRedo);
  const canAddRoute = useSelector(store, selectCanAddRoute);
  const imageLoaded = useSelector(store, selectImageLoaded);

  useEffect(() => {
    const sub = keyDown$.subscribe((e: KeyboardEvent) => {
      if (isTypingInField()) return;
      const key = e.key.toLowerCase();

      // Undo / redo
      if (key === SHORTCUTS.undo.key && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) store.put({ id: "history/redo" });
        } else if (canUndo) {
          store.put({ id: "history/undo" });
        }
        return;
      }

      // Tool shortcuts — only when no modifier
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!imageLoaded) return;

      if (key === SHORTCUTS.select.key) {
        e.preventDefault();
        store.put({ id: "tool/set", data: "select" });
        store.put({ id: "mode/deselect" });
      } else if (key === SHORTCUTS.draw.key) {
        e.preventDefault();
        store.put({ id: "tool/set", data: "draw" });
        // Contextual: extend the selected route, else create a new one.
        if (editorMode.kind === "selected") {
          store.put({
            id: "mode/enterDrawing",
            data: { routeId: editorMode.routeId, resumed: true },
          });
        } else if (canAddRoute) {
          const id = uid();
          store.put({ id: "routes/create", data: { id } });
          store.put({ id: "mode/enterDrawing", data: { routeId: id } });
        }
      } else if (key === SHORTCUTS.annotate.key) {
        e.preventDefault();
        store.put({ id: "tool/set", data: "annotate" });
      } else if (key === SHORTCUTS.branch.key) {
        e.preventDefault();
        store.put({ id: "tool/set", data: "branch" });
      }
    });
    return () => sub.unsubscribe();
  }, [canUndo, canRedo, canAddRoute, imageLoaded, editorMode]);

  return null;
}
