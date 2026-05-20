import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { topoAtom, undoAtom, redoAtom } from "../state/atoms";
import { canRedoAtom, canUndoAtom } from "../state/computed";
import { setImageAtom, setTopoNameAtom } from "../state/actions";
import { TopoPicker } from "./TopoPicker";

async function readImageFile(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  // Decode with EXIF orientation applied so width/height match what the <img> displays.
  // Then bake the orientation into a fresh dataURL so the stored bytes have no EXIF rotation.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("Could not decode image");
  });
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not decode image");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(mime, mime === "image/jpeg" ? 0.92 : undefined);
  return { dataUrl, width, height };
}

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
    if (topo.routes.length > 0) {
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
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
        className={`icon-btn ${canUndo ? "" : "disabled"}`}
        onClick={() => canUndo && undo()}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8 L7 4 V6 H12 A2 2 0 0 1 14 8 V11 H12 V8 H7 V10 Z" />
        </svg>
        <span className="tip">Undo<kbd>⌘Z</kbd></span>
      </button>
      <button
        className={`icon-btn ${canRedo ? "" : "disabled"}`}
        onClick={() => canRedo && redo()}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 8 L9 4 V6 H4 A2 2 0 0 0 2 8 V11 H4 V8 H9 V10 Z" />
        </svg>
        <span className="tip">Redo<kbd>⌘⇧Z</kbd></span>
      </button>

      <div className="sep" />

      <button className="icon-btn" onClick={() => fileRef.current?.click()}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
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
    </header>
  );
}
