import { atom, getDefaultStore, type PrimitiveAtom } from "jotai";
import type { EditorMode } from "./mode";
import { emptyTopo, type Point, type Snapshot, type Topo } from "./types";

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

// === Sub-system slice atoms (read side) ===
// Reading through a slice means a component only re-renders when *its* slice
// changes — and it never reaches into the Topo shape directly.
export const displayAtom = atom((get) => get(topoAtom).display);
export const contentAtom = atom((get) => get(topoAtom).snapshot);
export const metadataAtom = atom((get) => get(topoAtom).metadata);

// === Sub-system update functions (write side) ===
// Plain function calls — no `set(atom, ...)` ceremony at call sites.
// Assumes the default Jotai store (topomake is single-store; if Provider-scoped
// stores are ever introduced these helpers will silently miss them).
export const updateDisplay = (
  ta: PrimitiveAtom<Topo>,
  fn: (d: Topo["display"]) => Topo["display"],
): void => {
  const store = getDefaultStore();
  const t = store.get(ta);
  store.set(ta, { ...t, display: fn(t.display) });
};

export const updateContent = (
  ta: PrimitiveAtom<Topo>,
  fn: (c: Topo["snapshot"]) => Topo["snapshot"],
): void => {
  const store = getDefaultStore();
  const t = store.get(ta);
  store.set(ta, { ...t, snapshot: fn(t.snapshot) });
};

export const updateMetadata = (
  ta: PrimitiveAtom<Topo>,
  fn: (m: Topo["metadata"]) => Topo["metadata"],
): void => {
  const store = getDefaultStore();
  const t = store.get(ta);
  store.set(ta, { ...t, metadata: fn(t.metadata) });
};

// === History plumbing (write-only) ===
//
// History only tracks `Snapshot` (routes + annotations).
// Identity, name, image, display prefs, and metadata live on Topo but never
// participate in undo/redo.

// Commit a new content snapshot, pushing the previous one onto history.past and clearing future.
export const commitAtom = atom(null, (get, set, next: Snapshot) => {
  const prev = get(topoAtom);
  const hist = get(historyAtom);
  set(historyAtom, { past: [...hist.past, prev.snapshot], future: [] });
  set(topoAtom, { ...prev, snapshot: next });
});

// Push the current snapshot onto history without changing it — used to mark a drag start.
export const snapshotHistoryAtom = atom(null, (get, set) => {
  const topo = get(topoAtom);
  const hist = get(historyAtom);
  set(historyAtom, { past: [...hist.past, topo.snapshot], future: [] });
});

export const undoAtom = atom(null, (get, set) => {
  const hist = get(historyAtom);
  if (hist.past.length === 0) return;
  const prev = hist.past[hist.past.length - 1];
  const current = get(topoAtom);
  set(historyAtom, {
    past: hist.past.slice(0, -1),
    future: [current.snapshot, ...hist.future],
  });
  set(topoAtom, { ...current, snapshot: prev });
});

export const redoAtom = atom(null, (get, set) => {
  const hist = get(historyAtom);
  if (hist.future.length === 0) return;
  const next = hist.future[0];
  const current = get(topoAtom);
  set(historyAtom, {
    past: [...hist.past, current.snapshot],
    future: hist.future.slice(1),
  });
  set(topoAtom, { ...current, snapshot: next });
});
