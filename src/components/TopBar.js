import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import { topoAtom, undoAtom, redoAtom } from "../state/atoms";
import { setImageAtom, setShowBannerAtom, setStartNumberAtom, setTopoNameAtom } from "../state/actions";
import { downloadBlob, exportTopoPng } from "../util/export";
function readImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
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
    const [canUndo, undo] = useAtom(undoAtom);
    const [canRedo, redo] = useAtom(redoAtom);
    const setImage = useSetAtom(setImageAtom);
    const setName = useSetAtom(setTopoNameAtom);
    const setStartNumber = useSetAtom(setStartNumberAtom);
    const setShowBanner = useSetAtom(setShowBannerAtom);
    const fileRef = useRef(null);
    const onFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file)
            return;
        if (topo.routes.length > 0) {
            const ok = confirm("Replacing the image will keep existing routes. Continue?");
            if (!ok)
                return;
        }
        try {
            const data = await readImageFile(file);
            setImage(data);
        }
        catch (err) {
            alert(err.message);
        }
    };
    const onExport = async () => {
        try {
            const blob = await exportTopoPng(topo);
            const safe = (topo.name || "topo").replace(/[^a-z0-9-_]+/gi, "_");
            downloadBlob(blob, `${safe}.png`);
        }
        catch (err) {
            alert("Export failed: " + err.message);
        }
    };
    return (_jsxs("div", { className: "topbar", children: [_jsx("input", { className: "name-input", type: "text", value: topo.name, onChange: (e) => setName(e.target.value), placeholder: "Topo name" }), _jsxs("label", { children: ["Start #", _jsx("input", { type: "number", value: topo.startNumber, style: { width: 60 }, onChange: (e) => {
                            const n = parseInt(e.target.value, 10);
                            if (!isNaN(n))
                                setStartNumber(n);
                        } })] }), _jsx("button", { onClick: () => fileRef.current?.click(), children: topo.imageDataUrl ? "Replace image" : "Upload image" }), _jsxs("label", { style: { cursor: "pointer" }, children: [_jsx("input", { type: "checkbox", checked: topo.showBanner, onChange: (e) => setShowBanner(e.target.checked) }), "Banner"] }), _jsx("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: onFile }), _jsx("div", { className: "spacer" }), _jsx("button", { disabled: !canUndo, onClick: () => undo(), title: "Undo (\u2318Z)", children: "Undo" }), _jsx("button", { disabled: !canRedo, onClick: () => redo(), title: "Redo (\u21E7\u2318Z)", children: "Redo" }), _jsx("button", { className: "primary", disabled: !topo.imageDataUrl, onClick: onExport, children: "Export PNG" })] }));
}
