import { atom, useStore } from "jotai";
import { useEffect } from "react";
import { deleteTopo, listTopos, loadTopo, type StoredTopo, saveTopo } from "../util/storage";
import {
  dragOverrideAtom,
  editorModeAtom,
  type History,
  historyAtom,
  newTopoId,
  selectedAnnotationIdAtom,
  topoAtom,
} from "./atoms";
import { emptyTopo, type Topo } from "./types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export const saveStatusAtom = atom<SaveStatus>("idle");

// History entries are tiny Snapshots (no image) but we still cap depth.
const HISTORY_CAP = 20;
const trimHistory = (h: History): History => ({
  past: h.past.slice(-HISTORY_CAP),
  future: h.future.slice(0, HISTORY_CAP),
});

const editorModeForTopo = (topo: Topo) => ({
  kind: topo.image ? ("idle" as const) : ("empty" as const),
});

const topoFromRecord = (record: StoredTopo): Topo => ({
  id: record.id,
  name: record.name,
  image: record.image,
  startNumber: record.snapshot.startNumber,
  numberingOrder: record.snapshot.numberingOrder ?? "created",
  lineWidth: record.snapshot.lineWidth ?? 1,
  numberSize: record.snapshot.numberSize ?? 1,
  routes: record.snapshot.routes,
  annotations: record.snapshot.annotations,
});

// === Imperative actions (callable from UI) ===

export const loadTopoActionAtom = atom(null, async (_get, set, id: string) => {
  const record = await loadTopo(id);
  if (!record) return;
  const topo = topoFromRecord(record);
  set(topoAtom, topo);
  set(historyAtom, record.history);
  set(editorModeAtom, editorModeForTopo(topo));
  set(dragOverrideAtom, null);
  set(selectedAnnotationIdAtom, null);
});

export const newTopoActionAtom = atom(null, (_get, set) => {
  set(topoAtom, emptyTopo(newTopoId()));
  set(historyAtom, { past: [], future: [] });
  set(editorModeAtom, { kind: "empty" });
  set(dragOverrideAtom, null);
  set(selectedAnnotationIdAtom, null);
});

export const deleteTopoActionAtom = atom(null, async (get, set, id: string) => {
  await deleteTopo(id);
  if (get(topoAtom).id !== id) return;
  const metas = await listTopos();
  if (metas.length > 0) {
    await set(loadTopoActionAtom, metas[0].id);
  } else {
    set(newTopoActionAtom);
  }
});

// === Auto-save hook ===

const DEBOUNCE_MS = 500;

export function usePersistence() {
  const store = useStore();

  useEffect(() => {
    let hydrated = false;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    const flushSave = async () => {
      const topo = store.get(topoAtom);
      const history = trimHistory(store.get(historyAtom));
      const record: StoredTopo = {
        id: topo.id,
        name: topo.name,
        updatedAt: Date.now(),
        image: topo.image,
        snapshot: {
          startNumber: topo.startNumber,
          numberingOrder: topo.numberingOrder,
          lineWidth: topo.lineWidth,
          numberSize: topo.numberSize,
          routes: topo.routes,
          annotations: topo.annotations,
        },
        history,
      };
      try {
        await saveTopo(record);
        store.set(saveStatusAtom, "saved");
      } catch (err) {
        console.error("[persistence] save failed", err);
        store.set(saveStatusAtom, "error");
      }
    };

    const scheduleSave = () => {
      if (!hydrated) return;
      store.set(saveStatusAtom, "saving");
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, DEBOUNCE_MS);
    };

    const unsubTopo = store.sub(topoAtom, scheduleSave);
    const unsubHistory = store.sub(historyAtom, scheduleSave);

    // Bootstrap: restore the most recently updated topo if one exists.
    (async () => {
      try {
        const metas = await listTopos();
        if (metas.length > 0) {
          const record = await loadTopo(metas[0].id);
          if (record) {
            const topo = topoFromRecord(record);
            store.set(topoAtom, topo);
            store.set(historyAtom, record.history);
            store.set(editorModeAtom, editorModeForTopo(topo));
          }
        }
      } catch (err) {
        console.error("[persistence] bootstrap failed", err);
      } finally {
        hydrated = true;
        store.set(saveStatusAtom, "saved");
      }
    })();

    return () => {
      unsubTopo();
      unsubHistory();
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, [store]);
}
