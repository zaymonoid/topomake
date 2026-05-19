import { atom } from "jotai";
import { emptyTopo, Topo } from "./types";
import { EditorMode } from "./mode";

type History = { past: Topo[]; future: Topo[] };

export type Tool = "select" | "draw" | "annotate";

// === Primitives — the only writable atoms ===
export const topoAtom = atom<Topo>(emptyTopo());
export const editorModeAtom = atom<EditorMode>({ kind: "empty" });
export const historyAtom = atom<History>({ past: [], future: [] });
export const currentToolAtom = atom<Tool>("select");
export const selectedAnnotationIdAtom = atom<string | null>(null);

// === History plumbing (write-only) ===

// Commit a new topo state, pushing the previous onto history.past and clearing future.
export const commitAtom = atom(null, (get, set, next: Topo) => {
  const prev = get(topoAtom);
  const hist = get(historyAtom);
  set(historyAtom, { past: [...hist.past, prev], future: [] });
  set(topoAtom, next);
});

// Push current state onto history without changing it — used to snapshot before a drag.
export const snapshotHistoryAtom = atom(null, (get, set) => {
  const topo = get(topoAtom);
  const hist = get(historyAtom);
  set(historyAtom, { past: [...hist.past, topo], future: [] });
});

export const undoAtom = atom(null, (get, set) => {
  const hist = get(historyAtom);
  if (hist.past.length === 0) return;
  const prev = hist.past[hist.past.length - 1];
  const current = get(topoAtom);
  set(historyAtom, {
    past: hist.past.slice(0, -1),
    future: [current, ...hist.future],
  });
  set(topoAtom, prev);
});

export const redoAtom = atom(null, (get, set) => {
  const hist = get(historyAtom);
  if (hist.future.length === 0) return;
  const next = hist.future[0];
  const current = get(topoAtom);
  set(historyAtom, {
    past: [...hist.past, current],
    future: hist.future.slice(1),
  });
  set(topoAtom, next);
});
