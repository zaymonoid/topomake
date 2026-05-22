import { useSelector } from "@zaymonoid/katha/react";
import type { SaveStatus } from "../state/reducer";
import {
  selectCurrentRoute,
  selectCurrentTool,
  selectMode,
  selectModeHint,
  selectRouteNumbers,
  selectSaveStatus,
} from "../state/selectors";
import { store } from "../state/store";

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
  const tool = useSelector(store, selectCurrentTool);
  const route = useSelector(store, selectCurrentRoute);
  const routeNumbers = useSelector(store, selectRouteNumbers);
  const hint = useSelector(store, selectModeHint);
  const mode = useSelector(store, selectMode);
  const saveStatus = useSelector(store, selectSaveStatus);

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
