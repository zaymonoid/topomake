import { atom } from "jotai";
import { topoAtom, historyAtom, commitAtom, selectedRouteIdAtom, drawingRouteIdAtom } from "./atoms";
const uid = () => Math.random().toString(36).slice(2, 10);
const nextNumber = (topo) => {
    if (topo.routes.length === 0)
        return topo.startNumber;
    const max = Math.max(...topo.routes.map((r) => r.number));
    return max + 1;
};
// ---- Image ----
export const setImageAtom = atom(null, (get, set, payload) => {
    const topo = get(topoAtom);
    set(commitAtom, {
        ...topo,
        imageDataUrl: payload.dataUrl,
        imageWidth: payload.width,
        imageHeight: payload.height,
    });
});
// ---- Topo meta ----
export const setTopoNameAtom = atom(null, (get, set, name) => {
    set(commitAtom, { ...get(topoAtom), name });
});
export const setShowBannerAtom = atom(null, (get, set, showBanner) => {
    set(commitAtom, { ...get(topoAtom), showBanner });
});
export const setStartNumberAtom = atom(null, (get, set, startNumber) => {
    const topo = get(topoAtom);
    // If routes exist, shift them so the lowest number maps to the new start.
    if (topo.routes.length === 0) {
        set(commitAtom, { ...topo, startNumber });
        return;
    }
    const minNum = Math.min(...topo.routes.map((r) => r.number));
    const delta = startNumber - minNum;
    set(commitAtom, {
        ...topo,
        startNumber,
        routes: topo.routes.map((r) => ({ ...r, number: r.number + delta })),
    });
});
// ---- Routes ----
export const createRouteAtom = atom(null, (get, set) => {
    const topo = get(topoAtom);
    const id = uid();
    const route = {
        id,
        number: nextNumber(topo),
        name: "",
        color: "blue",
        points: [],
    };
    set(commitAtom, { ...topo, routes: [...topo.routes, route] });
    set(selectedRouteIdAtom, id);
    set(drawingRouteIdAtom, id);
});
export const deleteRouteAtom = atom(null, (get, set, id) => {
    const topo = get(topoAtom);
    set(commitAtom, { ...topo, routes: topo.routes.filter((r) => r.id !== id) });
    if (get(selectedRouteIdAtom) === id)
        set(selectedRouteIdAtom, null);
    if (get(drawingRouteIdAtom) === id)
        set(drawingRouteIdAtom, null);
});
const patchRoute = (topo, id, patch) => ({
    ...topo,
    routes: topo.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
});
export const setRouteNameAtom = atom(null, (get, set, payload) => {
    set(commitAtom, patchRoute(get(topoAtom), payload.id, { name: payload.name }));
});
export const setRouteNumberAtom = atom(null, (get, set, payload) => {
    set(commitAtom, patchRoute(get(topoAtom), payload.id, { number: payload.number }));
});
export const setRouteColorAtom = atom(null, (get, set, payload) => {
    set(commitAtom, patchRoute(get(topoAtom), payload.id, { color: payload.color }));
});
// Append a point to the route currently being drawn.
export const appendDrawingPointAtom = atom(null, (get, set, p) => {
    const drawingId = get(drawingRouteIdAtom);
    if (!drawingId)
        return;
    const topo = get(topoAtom);
    const route = topo.routes.find((r) => r.id === drawingId);
    if (!route)
        return;
    set(commitAtom, patchRoute(topo, drawingId, { points: [...route.points, p] }));
});
export const finishDrawingAtom = atom(null, (_get, set) => {
    set(drawingRouteIdAtom, null);
});
// ---- Point manipulation (for drag) ----
// Drag flow: call beginDragAtom once (pushes snapshot), then setPointAtom during move (no extra history), then nothing on release.
export const beginInteractionAtom = atom(null, (get, set) => {
    const topo = get(topoAtom);
    const hist = get(historyAtom);
    set(historyAtom, { past: [...hist.past, topo], future: [] });
});
export const setPointNoCommitAtom = atom(null, (get, set, payload) => {
    const topo = get(topoAtom);
    set(topoAtom, {
        ...topo,
        routes: topo.routes.map((r) => r.id === payload.routeId
            ? { ...r, points: r.points.map((p, i) => (i === payload.index ? payload.point : p)) }
            : r),
    });
});
export const insertPointAtom = atom(null, (get, set, payload) => {
    const topo = get(topoAtom);
    const route = topo.routes.find((r) => r.id === payload.routeId);
    if (!route)
        return;
    const points = [...route.points];
    points.splice(payload.index, 0, payload.point);
    set(commitAtom, patchRoute(topo, payload.routeId, { points }));
});
export const deletePointAtom = atom(null, (get, set, payload) => {
    const topo = get(topoAtom);
    const route = topo.routes.find((r) => r.id === payload.routeId);
    if (!route)
        return;
    const points = route.points.filter((_, i) => i !== payload.index);
    set(commitAtom, patchRoute(topo, payload.routeId, { points }));
});
