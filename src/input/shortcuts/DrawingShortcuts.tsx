import { useSetAtom } from "jotai";
import { useButtonPressed } from "use-control";
import { inputMap } from "../inputMap";
import { cancelDrawingAtom, finishDrawingAtom } from "../../state/actions";
import { isTypingInField } from "../useFocusGuard";

export function DrawingShortcuts() {
  const finish = useSetAtom(finishDrawingAtom);
  const cancel = useSetAtom(cancelDrawingAtom);

  useButtonPressed(inputMap, "finish", () => {
    if (isTypingInField()) return;
    finish();
  });
  useButtonPressed(inputMap, "cancel", () => {
    if (isTypingInField()) return;
    cancel();
  });

  return null;
}
