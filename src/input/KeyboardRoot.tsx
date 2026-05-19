import { useAtomValue } from "jotai";
import { shortcutsScopeAtom } from "../state/computed";
import { GlobalShortcuts } from "./shortcuts/GlobalShortcuts";
import { DrawingShortcuts } from "./shortcuts/DrawingShortcuts";
import { SelectedShortcuts } from "./shortcuts/SelectedShortcuts";

export function KeyboardRoot() {
  const scope = useAtomValue(shortcutsScopeAtom);
  return (
    <>
      <GlobalShortcuts />
      {scope === "drawing" && <DrawingShortcuts />}
      {scope === "selected" && <SelectedShortcuts />}
    </>
  );
}
