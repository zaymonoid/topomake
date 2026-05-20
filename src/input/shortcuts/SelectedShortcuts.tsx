import { useAtomValue, useSetAtom } from "jotai";
import { useButtonPressed } from "use-control";
import { deleteRouteAtom, deselectAtom } from "../../state/actions";
import { selectedRouteIdAtom } from "../../state/computed";
import { inputMap } from "../inputMap";
import { isTypingInField } from "../useFocusGuard";

export function SelectedShortcuts() {
  const selectedId = useAtomValue(selectedRouteIdAtom);
  const deselect = useSetAtom(deselectAtom);
  const deleteRoute = useSetAtom(deleteRouteAtom);

  useButtonPressed(inputMap, "cancel", () => {
    if (isTypingInField()) return;
    deselect();
  });
  useButtonPressed(inputMap, "finish", () => {
    if (isTypingInField()) return;
    deselect();
  });
  useButtonPressed(inputMap, "deleteItem", () => {
    if (isTypingInField()) return;
    if (selectedId) deleteRoute(selectedId);
  });

  return null;
}
