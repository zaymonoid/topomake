import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { Canvas } from "./components/Canvas";
import { SidePanel } from "./components/SidePanel";
import { selectedRouteIdAtom, drawingRouteIdAtom, undoAtom, redoAtom } from "./state/atoms";
import { deleteRouteAtom, finishDrawingAtom } from "./state/actions";
export function App() {
    const [selectedId, setSelectedId] = useAtom(selectedRouteIdAtom);
    const drawingId = useAtomValue(drawingRouteIdAtom);
    const deleteRoute = useSetAtom(deleteRouteAtom);
    const finishDrawing = useSetAtom(finishDrawingAtom);
    const [canUndo, undo] = useAtom(undoAtom);
    const [canRedo, redo] = useAtom(redoAtom);
    useEffect(() => {
        const onKey = (e) => {
            const target = e.target;
            const inField = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
            const meta = e.metaKey || e.ctrlKey;
            if (meta && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) {
                    if (canRedo)
                        redo();
                }
                else if (canUndo) {
                    undo();
                }
                return;
            }
            if (inField)
                return;
            if (e.key === "Enter" && drawingId) {
                finishDrawing();
                return;
            }
            if (e.key === "Escape") {
                if (drawingId)
                    finishDrawing();
                else if (selectedId)
                    setSelectedId(null);
                return;
            }
            if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !drawingId) {
                deleteRoute(selectedId);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedId, drawingId, canUndo, canRedo, undo, redo, deleteRoute, finishDrawing, setSelectedId]);
    return (_jsxs("div", { className: "app", children: [_jsx(TopBar, {}), _jsxs("div", { className: "main", children: [_jsx(Canvas, {}), _jsx(SidePanel, {})] })] }));
}
