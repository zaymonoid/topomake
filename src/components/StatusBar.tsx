import { useAtomValue } from "jotai";
import { currentToolAtom, editorModeAtom } from "../state/atoms";
import { currentRouteAtom, modeHintAtom } from "../state/computed";
import { saveStatusAtom, SaveStatus } from "../state/persistence";

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
  const hint = useAtomValue(modeHintAtom);
  const mode = useAtomValue(editorModeAtom);
  const saveStatus = useAtomValue(saveStatusAtom);

  const hints = hint?.hints ?? [];
  const isDrawing = mode.kind === "drawing";

  return (
    <footer className="statusbar">
      <span className="mode-pill">{TOOL_LABEL[tool] ?? tool}</span>
      {route ? (
        <span>{isDrawing ? "Drawing" : "Route"} #{route.number} · {route.points.length} pts</span>
      ) : hint?.title ? (
        <span>{hint.title}</span>
      ) : null}
      {hints.length > 0 && (
        <span className="hints">
          {hints.map((h, i) => (
            <span className="hint" key={i}>{h}</span>
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
