import { atom } from "jotai";
import { emptyTopo, Point, Snapshot, Topo } from "./types";
import { EditorMode } from "./mode";

export type History = { past: Snapshot[]; future: Snapshot[] };

export type Tool = "select" | "draw" | "annotate" | "branch";

export type DragOverride = { routeId: string; pointIndex: number; point: Point } | null;

export type HoveredHandle = { routeId: string; index: number } | null;

export const newTopoId = () =>
  globalThis.crypto?.randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

// === Primitives — the only writable atoms ===
export const topoAtom = atom<Topo>(emptyTopo(newTopoId()));
export const editorModeAtom = atom<EditorMode>({ kind: "empty" });
export const historyAtom = atom<History>({ past: [], future: [] });
export const currentToolAtom = atom<Tool>("select");
export const selectedAnnotationIdAtom = atom<string | null>(null);
// Identity now lives inside the topo itself — this is just a convenience read.
export const currentTopoIdAtom = atom((get) => get(topoAtom).id);
// Live position of the point being dragged. Stays null except during a drag.
// Kept out of topoAtom so per-frame moves don't trigger app-wide re-renders.
export const dragOverrideAtom = atom<DragOverride>(null);
// Which handle the pointer is currently over while the branch tool is active.
// Drives the "Add variation" tooltip in RouteShape.
export const hoveredHandleAtom = atom<HoveredHandle>(null);
// Snapshot captured when entering an extend (resumed drawing) session, so Esc
// can revert to the state before the user started adding points. Transient —
// not part of history, just a side-channel for the cancel action.
export const extendStartSnapshotAtom = atom<Snapshot | null>(null);

// === History plumbing (write-only) ===
//
// History only tracks `Snapshot` (startNumber + routes + annotations).
// Identity, name, and image live on Topo but never participate in undo/redo —
// they're set once or edited inline (renames aren't history events).

const toSnapshot = (t: Topo): Snapshot => ({
  startNumber: t.startNumber,
  numberingOrder: t.numberingOrder,
  lineWidth: t.lineWidth,
  numberSize: t.numberSize,
  routes: t.routes,
  annotations: t.annotations,
});

// Commit a new editable-state, pushing the previous snapshot onto history.past and clearing future.
export const commitAtom = atom(null, (get, set, next: Snapshot) => {
  const prev = get(topoAtom);
  const hist = get(historyAtom);
  set(historyAtom, { past: [...hist.past, toSnapshot(prev)], future: [] });
  set(topoAtom, { ...prev, ...next });
});

// Push the current snapshot onto history without changing it — used to mark a drag start.
export const snapshotHistoryAtom = atom(null, (get, set) => {
  const topo = get(topoAtom);
  const hist = get(historyAtom);
  set(historyAtom, { past: [...hist.past, toSnapshot(topo)], future: [] });
});

export const undoAtom = atom(null, (get, set) => {
  const hist = get(historyAtom);
  if (hist.past.length === 0) return;
  const prev = hist.past[hist.past.length - 1];
  const current = get(topoAtom);
  set(historyAtom, {
    past: hist.past.slice(0, -1),
    future: [toSnapshot(current), ...hist.future],
  });
  set(topoAtom, { ...current, ...prev });
});

export const redoAtom = atom(null, (get, set) => {
  const hist = get(historyAtom);
  if (hist.future.length === 0) return;
  const next = hist.future[0];
  const current = get(topoAtom);
  set(historyAtom, {
    past: [...hist.past, toSnapshot(current)],
    future: hist.future.slice(1),
  });
  set(topoAtom, { ...current, ...next });
});
