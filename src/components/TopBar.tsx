import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { SHORTCUTS } from "../input/shortcuts";
import { setImageAtom, setTopoNameAtom } from "../state/actions";
import { redoAtom, topoAtom, undoAtom } from "../state/atoms";
import { canRedoAtom, canUndoAtom } from "../state/computed";
import { readImageFile } from "../util/image";
import { TopoPicker } from "./TopoPicker";

export function TopBar() {
  const topo = useAtomValue(topoAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const setImage = useSetAtom(setImageAtom);
  const setName = useSetAtom(setTopoNameAtom);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (topo.snapshot.routes.length > 0) {
      const ok = confirm("Replacing the image will keep existing routes. Continue?");
      if (!ok) return;
    }
    try {
      const data = await readImageFile(file);
      setImage(data);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <div className="mark" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="#fff"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 18 Q8 6 12 10 T 21 6" />
            <path d="M3 14 Q8 4 12 7 T 21 3" opacity="0.5" />
          </svg>
        </div>
        <div className="name">topomaker</div>
      </div>

      <div className="sep" />

      <TopoPicker />

      <div className="crag-input-wrap">
        <span className="label">CRAG</span>
        <input
          className="crag-input"
          value={topo.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled Topo"
        />
      </div>

      <div className="sep" />

      <button
        type="button"
        className="icon-btn"
        onClick={() => fileRef.current?.click()}
        aria-label={topo.image ? "Replace image" : "Upload image"}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="12" height="9" rx="1" />
          <circle cx="6" cy="7" r="1.4" />
          <path d="M2 11 L6 7.5 L10 10 L14 6" />
        </svg>
        <span className="tip">{topo.image ? "Replace image" : "Upload image"}</span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFile}
      />

      <div className="spacer" />

      <div className="history-group">
        <button
          type="button"
          className={`history-btn ${canUndo ? "" : "disabled"}`}
          onClick={() => canUndo && undo()}
          aria-label="Undo"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3.5 6.5 H9.5 A3 3 0 0 1 12.5 9.5 A3 3 0 0 1 9.5 12.5 H6" />
            <path d="M6 3.5 L3 6.5 L6 9.5" />
          </svg>
          <span className="tip">
            Undo<kbd>{SHORTCUTS.undo.label}</kbd>
          </span>
        </button>
        <div className="history-divider" aria-hidden="true" />
        <button
          type="button"
          className={`history-btn ${canRedo ? "" : "disabled"}`}
          onClick={() => canRedo && redo()}
          aria-label="Redo"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12.5 6.5 H6.5 A3 3 0 0 0 3.5 9.5 A3 3 0 0 0 6.5 12.5 H10" />
            <path d="M10 3.5 L13 6.5 L10 9.5" />
          </svg>
          <span className="tip">
            Redo<kbd>{SHORTCUTS.redo.label}</kbd>
          </span>
        </button>
      </div>
    </header>
  );
}
