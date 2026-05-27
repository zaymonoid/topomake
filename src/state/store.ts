/**
 * Module-level store boot.
 *
 * The Effect runtime + katha store live entirely outside the React tree. The
 * exported `store` is a plain JS `StoreHandle` (get / put / subscribe).
 * Components import it directly and use the `useSelector` hook from
 * `@zaymonoid/katha/react` for reactive reads.
 *
 * Implementation: `createStoreRef` returns a `StoreHandle` synchronously and
 * buffers actions until the Effect store boots. `ManagedRuntime.runPromise`
 * starts the runtime; once `AppStore` resolves, we `attach` the real store to
 * the ref. Buffered actions flush at attach time.
 */
import { createStoreRef, makeStore } from "@zaymonoid/katha";
import { Effect, ManagedRuntime } from "effect";
import {
  type Action,
  initialState as reducerInitial,
  rootProcess,
  rootReducer,
  type State,
} from "./root";
import { emptyTopo } from "./types";

// Seed with a fresh empty topo (id will be replaced by bootstrap if it loads
// something from IndexedDB; otherwise this is the working topo).
const seed: State = {
  ...reducerInitial,
  topo: emptyTopo(
    globalThis.crypto?.randomUUID?.() ??
      Math.random().toString(36).slice(2) + Date.now().toString(36),
  ),
};

const { ref, attach } = createStoreRef<State, Action>(seed);

class AppStore extends Effect.Service<AppStore>()("AppStore", {
  scoped: makeStore({
    initialState: seed,
    reduce: rootReducer,
    process: rootProcess,
  }),
}) {}

const runtime = ManagedRuntime.make(AppStore.Default);

// Fire-and-forget boot. Errors are surfaced to the console; the app continues
// to function via the buffered ref (which can still accept actions, they just
// queue until attach succeeds).
runtime
  .runPromise(AppStore)
  .then(attach)
  .catch((err) => {
    console.error("[store] failed to boot katha runtime", err);
  });

export const store = ref;
