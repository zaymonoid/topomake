import { useAtomValue, useSetAtom } from "jotai";
import { useButtonPressed } from "use-control";
import { inputMap } from "../inputMap";
import { deselectAtom, deleteRouteAtom } from "../../state/actions";
import { selectedRouteIdAtom } from "../../state/computed";
import { isTypingInField } from "../useFocusGuard";

export function SelectedShortcuts() {
  const selectedId = useAtomValue(selectedRouteIdAtom);
  const deselect = useSetAtom(deselectAtom);
  const deleteRoute = useSetAtom(deleteRouteAtom);

  useButtonPressed(inputMap, "cancel", () => {
    if (isTypingInField()) return;
    deselect();
  });
  useButtonPressed(inputMap, "deleteItem", () => {
    if (isTypingInField()) return;
    if (selectedId) deleteRoute(selectedId);
  });

  return null;
}
