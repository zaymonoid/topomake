/** Short random id used for routes, annotations, and other intra-topo records. */
export const uid = (): string => Math.random().toString(36).slice(2, 10);

/** A new topo id — slightly longer / time-tagged so two fresh topos can't collide. */
export const newTopoId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);
