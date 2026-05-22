import { useAtomValue } from "jotai";
import { currentToolAtom, editorModeAtom } from "../state/atoms";
import { currentRouteAtom, modeHintAtom, routeNumbersAtom } from "../state/computed";
import { type SaveStatus, saveStatusAtom } from "../state/persistence";

const TOOL_LABEL: Record<string, string> = {
  select: "Select",
  draw: "Draw",
  annotate: "Annotate",
};

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "—",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

export function StatusBar() {
  const tool = useAtomValue(currentToolAtom);
  const route = useAtomValue(currentRouteAtom);
  const routeNumbers = useAtomValue(routeNumbersAtom);
  const hint = useAtomValue(modeHintAtom);
  const mode = useAtomValue(editorModeAtom);
  const saveStatus = useAtomValue(saveStatusAtom);

  const hints = hint?.hints ?? [];
  const isDrawing = mode.kind === "drawing";
  const isExtending = mode.kind === "drawing" && mode.resumed === true;
  const isVariation = route?.branchFrom !== undefined;
  const routeLabel = isExtending
    ? "Extending"
    : isDrawing
      ? "Drawing"
      : isVariation
        ? "Variation"
        : "Route";
  const routeIdentifier = isVariation
    ? route?.name?.trim() || "(unnamed)"
    : `#${(route && routeNumbers.get(route.id)) ?? "?"}`;

  return (
    <footer className="statusbar">
      <span className="mode-pill">{TOOL_LABEL[tool] ?? tool}</span>
      {route ? (
        <span>
          {routeLabel} {routeIdentifier}
        </span>
      ) : hint?.title ? (
        <span>{hint.title}</span>
      ) : null}
      {hints.length > 0 && (
        <span className="hints">
          {hints.map((h) => (
            <span className="hint" key={h}>
              {h}
            </span>
          ))}
        </span>
      )}
      <span className="right">
        <span>100%</span>
        <span className={`save-status save-${saveStatus}`}>{SAVE_LABEL[saveStatus]}</span>
      </span>
    </footer>
  );
}
