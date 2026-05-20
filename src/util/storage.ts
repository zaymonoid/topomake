import { Image, Snapshot } from "../state/types";
import { History } from "../state/atoms";

const DB_NAME = "topomake";
const DB_VERSION = 3;
const META_STORE = "topo_meta";
const DATA_STORE = "topo_data";
const LEGACY_STORES = ["topos"]; // dropped in v2 / v3

export type TopoMeta = {
  id: string;
  name: string;
  updatedAt: number;
};

type TopoData = {
  id: string;
  image: Image | null;
  snapshot: Snapshot;
  history: History;
};

export type StoredTopo = TopoMeta & {
  image: Image | null;
  snapshot: Snapshot;
  history: History;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;
      // v3 changes the data store's record shape (image broken out, history is
      // Snapshot[] not Topo[]). Old data is incompatible; dev-stage so drop it.
      if (oldVersion < 3) {
        for (const name of [META_STORE, DATA_STORE, ...LEGACY_STORES]) {
          if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
        }
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        const meta = db.createObjectStore(META_STORE, { keyPath: "id" });
        meta.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveTopo(record: StoredTopo): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([META_STORE, DATA_STORE], "readwrite");
  const meta: TopoMeta = { id: record.id, name: record.name, updatedAt: record.updatedAt };
  const data: TopoData = {
    id: record.id,
    image: record.image,
    snapshot: record.snapshot,
    history: record.history,
  };
  tx.objectStore(META_STORE).put(meta);
  tx.objectStore(DATA_STORE).put(data);
  await txDone(tx);
}

export async function loadTopo(id: string): Promise<StoredTopo | null> {
  const db = await openDb();
  const tx = db.transaction([META_STORE, DATA_STORE], "readonly");
  const [meta, data] = await Promise.all([
    reqToPromise(tx.objectStore(META_STORE).get(id)) as Promise<TopoMeta | undefined>,
    reqToPromise(tx.objectStore(DATA_STORE).get(id)) as Promise<TopoData | undefined>,
  ]);
  if (!meta || !data) return null;
  return {
    id: meta.id,
    name: meta.name,
    updatedAt: meta.updatedAt,
    image: data.image,
    snapshot: data.snapshot,
    history: data.history,
  };
}

export async function listTopos(): Promise<TopoMeta[]> {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readonly");
  const all = (await reqToPromise(tx.objectStore(META_STORE).getAll())) as TopoMeta[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteTopo(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([META_STORE, DATA_STORE], "readwrite");
  tx.objectStore(META_STORE).delete(id);
  tx.objectStore(DATA_STORE).delete(id);
  await txDone(tx);
}
