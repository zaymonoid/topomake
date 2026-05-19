import { atom } from "jotai";
import { emptyTopo } from "./types";
export const topoAtom = atom(emptyTopo());
export const historyAtom = atom({ past: [], future: [] });
export const selectedRouteIdAtom = atom(null);
// drawingRouteIdAtom: id of a route currently being drawn (placing points).
// While set, canvas clicks append points to that route.
export const drawingRouteIdAtom = atom(null);
// Commit a new topo state, pushing the previous onto history.past and clearing future.
export const commitAtom = atom(null, (get, set, next) => {
    const prev = get(topoAtom);
    const hist = get(historyAtom);
    set(historyAtom, { past: [...hist.past, prev], future: [] });
    set(topoAtom, next);
});
export const undoAtom = atom((get) => get(historyAtom).past.length > 0, (get, set) => {
    const hist = get(historyAtom);
    if (hist.past.length === 0)
        return;
    const prev = hist.past[hist.past.length - 1];
    const current = get(topoAtom);
    set(historyAtom, {
        past: hist.past.slice(0, -1),
        future: [current, ...hist.future],
    });
    set(topoAtom, prev);
});
export const redoAtom = atom((get) => get(historyAtom).future.length > 0, (get, set) => {
    const hist = get(historyAtom);
    if (hist.future.length === 0)
        return;
    const next = hist.future[0];
    const current = get(topoAtom);
    set(historyAtom, {
        past: [...hist.past, current],
        future: hist.future.slice(1),
    });
    set(topoAtom, next);
});
