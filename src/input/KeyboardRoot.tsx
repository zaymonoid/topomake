import { useSelector } from "@zaymonoid/katha/react";
import { selectShortcutsScope } from "../state/selectors";
import { store } from "../state/store";
import { DrawingShortcuts } from "./shortcuts/DrawingShortcuts";
import { GlobalShortcuts } from "./shortcuts/GlobalShortcuts";
import { SelectedShortcuts } from "./shortcuts/SelectedShortcuts";

export function KeyboardRoot() {
  const scope = useSelector(store, selectShortcutsScope);
  return (
    <>
      <GlobalShortcuts />
      {scope === "drawing" && <DrawingShortcuts />}
      {scope === "selected" && <SelectedShortcuts />}
    </>
  );
}
