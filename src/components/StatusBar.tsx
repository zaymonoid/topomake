import { useAtomValue } from "jotai";
import { currentToolAtom } from "../state/atoms";
import { currentRouteAtom, modeHintAtom } from "../state/computed";

const TOOL_LABEL: Record<string, string> = {
  select: "Select",
  draw: "Draw",
  annotate: "Annotate",
};

export function StatusBar() {
  const tool = useAtomValue(currentToolAtom);
  const route = useAtomValue(currentRouteAtom);
  const hint = useAtomValue(modeHintAtom);

  const hints = hint?.hints ?? [];

  return (
    <footer className="statusbar">
      <span className="mode-pill">{TOOL_LABEL[tool] ?? tool}</span>
      {route ? (
        <span>Route #{route.number} · {route.points.length} pts</span>
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
        <span>localStorage</span>
      </span>
    </footer>
  );
}
