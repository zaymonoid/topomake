import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { topoAtom, selectedRouteIdAtom, drawingRouteIdAtom } from "../state/atoms";
import { createRouteAtom, deleteRouteAtom, finishDrawingAtom, setRouteColorAtom, setRouteNameAtom, setRouteNumberAtom, } from "../state/actions";
import { PALETTE } from "../state/types";
const COLORS = ["blue", "white", "red", "yellow"];
export function SidePanel() {
    const topo = useAtomValue(topoAtom);
    const [selectedId, setSelectedId] = useAtom(selectedRouteIdAtom);
    const drawingId = useAtomValue(drawingRouteIdAtom);
    const createRoute = useSetAtom(createRouteAtom);
    const deleteRoute = useSetAtom(deleteRouteAtom);
    const setName = useSetAtom(setRouteNameAtom);
    const setNumber = useSetAtom(setRouteNumberAtom);
    const setColor = useSetAtom(setRouteColorAtom);
    const finishDrawing = useSetAtom(finishDrawingAtom);
    const selected = topo.routes.find((r) => r.id === selectedId) ?? null;
    const canCreate = topo.imageDataUrl !== null && !drawingId;
    return (_jsxs("aside", { className: "sidepanel", children: [_jsxs("div", { children: [_jsx("h3", { children: "Routes" }), _jsx("button", { className: "primary", disabled: !canCreate, onClick: () => createRoute(), children: "+ Add route" }), drawingId && (_jsx("button", { style: { marginLeft: 6 }, onClick: () => finishDrawing(), children: "Finish drawing" }))] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [topo.routes.length === 0 && (_jsx("p", { style: { color: "#666", fontSize: 12 }, children: "No routes yet." })), topo.routes.map((r) => (_jsxs("div", { className: `route-row ${r.id === selectedId ? "selected" : ""}`, onClick: () => setSelectedId(r.id), children: [_jsx("span", { className: "num", style: { background: PALETTE[r.color], color: r.color === "white" || r.color === "yellow" ? "#000" : "#fff" }, children: r.number }), _jsx("span", { className: "name", children: r.name || _jsx("em", { style: { color: "#666" }, children: "unnamed" }) })] }, r.id)))] }), selected && (_jsxs("div", { className: "route-editor", children: [_jsxs("h3", { style: { marginBottom: 0 }, children: ["Route ", selected.number, " ", drawingId === selected.id && _jsx("span", { style: { color: "#888", fontWeight: 400 }, children: "(drawing\u2026)" })] }), _jsxs("div", { children: [_jsx("label", { children: "Name" }), _jsx("input", { type: "text", value: selected.name, onChange: (e) => setName({ id: selected.id, name: e.target.value }), placeholder: "e.g. Whip-poor-will" })] }), _jsxs("div", { children: [_jsx("label", { children: "Number" }), _jsx("input", { type: "number", value: selected.number, onChange: (e) => {
                                    const n = parseInt(e.target.value, 10);
                                    if (!isNaN(n))
                                        setNumber({ id: selected.id, number: n });
                                } })] }), _jsxs("div", { children: [_jsx("label", { children: "Color" }), _jsx("div", { className: "swatches", children: COLORS.map((c) => (_jsx("button", { type: "button", className: `swatch ${selected.color === c ? "selected" : ""}`, style: { background: PALETTE[c], padding: 0 }, onClick: () => setColor({ id: selected.id, color: c }), "aria-label": c }, c))) })] }), _jsx("button", { onClick: () => deleteRoute(selected.id), style: { marginTop: 4 }, children: "Delete route" }), _jsx("p", { style: { fontSize: 11, color: "#888", margin: 0 }, children: drawingId === selected.id
                            ? "Click on the image to place points. Press Enter or click 'Finish drawing' when done."
                            : "Drag handles to reshape. Click between handles to insert a point. Right-click a handle to delete it." })] }))] }));
}
