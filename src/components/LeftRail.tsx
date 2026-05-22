import { useSelector } from "@zaymonoid/katha/react";
import type { Tool } from "../state/actions";
import {
  selectCanAddRoute,
  selectCurrentTool,
  selectImageLoaded,
  selectMode,
} from "../state/selectors";
import { store } from "../state/store";
import { uid } from "../util/id";

export function LeftRail() {
  const tool = useSelector(store, selectCurrentTool);
  const imageLoaded = useSelector(store, selectImageLoaded);
  const canAdd = useSelector(store, selectCanAddRoute);
  const mode = useSelector(store, selectMode);

  const onSelect = (next: Tool) => {
    if (next === "select") {
      store.put({ id: "tool/set", data: "select" });
      store.put({ id: "mode/deselect" });
      return;
    }
    if (next === "draw") {
      store.put({ id: "tool/set", data: "draw" });
      // Contextual: extend the selected route if one is selected; else create new.
      if (mode.kind === "selected") {
        store.put({
          id: "mode/enterDrawing",
          data: { routeId: mode.routeId, resumed: true },
        });
      } else if (canAdd) {
        const id = uid();
        store.put({ id: "routes/create", data: { id } });
        store.put({ id: "mode/enterDrawing", data: { routeId: id } });
      }
      return;
    }
    if (next === "annotate") {
      store.put({ id: "tool/set", data: "annotate" });
      return;
    }
    if (next === "branch") {
      store.put({ id: "tool/set", data: "branch" });
      return;
    }
  };

  return (
    <aside className="rail">
      <button
        type="button"
        className={`tool ${tool === "select" ? "active" : ""}`}
        onClick={() => onSelect("select")}
        disabled={!imageLoaded}
        aria-label="Select"
      >
        <svg viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <path d="M3 2 L3 14 L6.5 11 L8.5 15.5 L10.5 14.5 L8.5 10 L13 10 Z" />
        </svg>
        <span className="kbd">V</span>
        <span className="tip">Select &nbsp;V</span>
      </button>
      <button
        type="button"
        className={`tool ${tool === "draw" ? "active" : ""}`}
        onClick={() => onSelect("draw")}
        disabled={!imageLoaded}
        aria-label="Draw route"
      >
        <svg
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="4" cy="14" r="2" fill="currentColor" />
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="14" cy="2" r="1.5" fill="currentColor" />
          <path d="M4 14 Q5 10 9 6 T 14 2" />
        </svg>
        <span className="kbd">R</span>
        <span className="tip">Draw route &nbsp;R</span>
      </button>
      <button
        type="button"
        className={`tool ${tool === "annotate" ? "active" : ""}`}
        onClick={() => onSelect("annotate")}
        disabled={!imageLoaded}
        aria-label="Annotate"
      >
        <svg
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 4 H13 A2 2 0 0 1 15 6 V11 A2 2 0 0 1 13 13 H8 L5 16 V13 H4 A2 2 0 0 1 2 11 V6 A2 2 0 0 1 3 4 Z" />
          <path d="M6 8 H11 M6 10 H9" />
        </svg>
        <span className="kbd">T</span>
        <span className="tip">Annotate &nbsp;T</span>
      </button>
      <button
        type="button"
        className={`tool ${tool === "branch" ? "active" : ""}`}
        onClick={() => onSelect("branch")}
        disabled={!imageLoaded}
        aria-label="Variation"
      >
        <svg
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 16 L9 11" />
          <path d="M9 11 Q9 8 5 5" />
          <path d="M9 11 Q9 8 13 5" />
          <circle cx="9" cy="11" r="1.6" fill="currentColor" />
          <circle cx="5" cy="4" r="1.2" />
          <circle cx="13" cy="4" r="1.2" />
        </svg>
        <span className="kbd">B</span>
        <span className="tip">Variation &nbsp;B</span>
      </button>
      <div className="rail-spacer" />
      <button type="button" className="tool" disabled aria-label="Shortcuts">
        <svg
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="M7 7 A2 2 0 0 1 11 7 Q11 9 9 10 V11" />
          <circle cx="9" cy="13" r="0.6" fill="currentColor" />
        </svg>
        <span className="tip">Shortcuts &nbsp;?</span>
      </button>
    </aside>
  );
}
