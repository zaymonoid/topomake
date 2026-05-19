import { useAtomValue } from "jotai";
import { modeHintAtom } from "../state/computed";

export function ModeBar() {
  const hint = useAtomValue(modeHintAtom);
  const visible = hint !== null;
  return (
    <div className={`mode-bar ${visible ? "visible" : ""}`} aria-live="polite">
      {hint && (
        <>
          <span className="mode-bar-title">{hint.title}</span>
          {hint.hints.length > 0 && (
            <span className="mode-bar-hints">{hint.hints.join(" · ")}</span>
          )}
        </>
      )}
    </div>
  );
}
