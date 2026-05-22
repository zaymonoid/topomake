import { useSelector } from "@zaymonoid/katha/react";
import { useButtonPressed } from "use-control";
import { selectSelectedRouteId } from "../../state/selectors";
import { store } from "../../state/store";
import { inputMap } from "../inputMap";
import { isTypingInField } from "../useFocusGuard";

export function SelectedShortcuts() {
  const selectedId = useSelector(store, selectSelectedRouteId);

  useButtonPressed(inputMap, "cancel", () => {
    if (isTypingInField()) return;
    store.put({ id: "mode/deselect" });
  });
  useButtonPressed(inputMap, "finish", () => {
    if (isTypingInField()) return;
    store.put({ id: "mode/deselect" });
  });
  useButtonPressed(inputMap, "deleteItem", () => {
    if (isTypingInField()) return;
    if (selectedId) store.put({ id: "routes/delete", data: { id: selectedId } });
  });

  return null;
}
