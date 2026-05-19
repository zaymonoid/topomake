import { useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { topoAtom, undoAtom, redoAtom } from "../state/atoms";
import { canRedoAtom, canUndoAtom, exportableAtom } from "../state/computed";
import { setImageAtom, setShowBannerAtom, setStartNumberAtom, setTopoNameAtom } from "../state/actions";
import { downloadBlob, exportTopoPng } from "../util/export";

function readImageFile(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function TopBar() {
  const topo = useAtomValue(topoAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  const exportable = useAtomValue(exportableAtom);
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const setImage = useSetAtom(setImageAtom);
  const setName = useSetAtom(setTopoNameAtom);
  const setStartNumber = useSetAtom(setStartNumberAtom);
  const setShowBanner = useSetAtom(setShowBannerAtom);
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

  const onExport = async () => {
    try {
      const blob = await exportTopoPng(topo);
      const safe = (topo.name || "topo").replace(/[^a-z0-9-_]+/gi, "_");
      downloadBlob(blob, `${safe}.png`);
    } catch (err) {
      alert("Export failed: " + (err as Error).message);
    }
  };

  return (
    <div className="topbar">
      <input
        className="name-input"
        type="text"
        value={topo.name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Topo name"
      />
      <label>
        Start #
        <input
          type="number"
          value={topo.startNumber}
          style={{ width: 60 }}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n)) setStartNumber(n);
          }}
        />
      </label>
      <button onClick={() => fileRef.current?.click()}>
        {topo.imageDataUrl ? "Replace image" : "Upload image"}
      </button>
      <label style={{ cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={topo.showBanner}
          onChange={(e) => setShowBanner(e.target.checked)}
        />
        Banner
      </label>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFile}
      />
      <div className="spacer" />
      <button disabled={!canUndo} onClick={() => undo()} title="Undo (⌘Z)">Undo</button>
      <button disabled={!canRedo} onClick={() => redo()} title="Redo (⇧⌘Z)">Redo</button>
      <button className="primary" disabled={!exportable} onClick={onExport}>
        Export PNG
      </button>
    </div>
  );
}
