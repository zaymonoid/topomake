import { useAtomValue } from "jotai";
import { shortcutsScopeAtom } from "../state/computed";
import { DrawingShortcuts } from "./shortcuts/DrawingShortcuts";
import { GlobalShortcuts } from "./shortcuts/GlobalShortcuts";
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
