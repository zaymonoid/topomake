import { useButtonPressed } from "use-control";
import { store } from "../../state/store";
import { inputMap } from "../inputMap";
import { isTypingInField } from "../useFocusGuard";

export function DrawingShortcuts() {
  useButtonPressed(inputMap, "finish", () => {
    if (isTypingInField()) return;
    store.put({ id: "mode/finishDrawing" });
  });
  useButtonPressed(inputMap, "cancel", () => {
    if (isTypingInField()) return;
    store.put({ id: "mode/cancelDrawing" });
  });

  return null;
}
