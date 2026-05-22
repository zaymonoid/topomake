# topomake

## Tech

- Vite + React + TypeScript
- [@zaymonoid/katha](https://github.com/ZaymonFC/katha) saga-pattern store on Effect-TS for state + side effects
- Biome for lint/format
- Vitest (+ `@effect/vitest`) for tests

## Architecture

State and side-effect coordination live outside React in a katha store:

- `src/state/types.ts` — domain types (Topo, Snapshot, Route, Annotation, …)
- `src/state/actions.ts` — discriminated `Action` union; the API surface for all writes
- `src/state/reducer.ts` — slice reducers + custom root reducer (handles cross-slice undo/redo + topo/new)
- `src/state/processes.ts` — saga-shaped Effects: `historyTracker`, `autosave`, `bootstrap`, `dragSession`, `extendSession`, `imageLoad`, `modeTransitions`
- `src/state/selectors.ts` — pure functions over state (materialised: drag overlay applied)
- `src/state/store.ts` — module-level boot via `createStoreRef` + `ManagedRuntime`
- `src/state/derive.ts` — pure helpers shared by selectors + non-store callers (exporters)

React components consume via `useSelector(store, selectX)` from `@zaymonoid/katha/react` and dispatch via `store.put({ id, data })`. They never reach into individual slices — `selectRoutes` returns drag-merged routes; `selectRouteNumbers` returns derived labels.

## Commands

- `npm run dev` — start dev server
- `npm run build` — typecheck + production build
- `npm run check` — Biome lint/format with autofix
- `npm run lint` — Biome lint only
- `npm run format` — Biome format only
- `npm run test` — vitest in watch mode
- `npm run test:run` — vitest single run

**Every code change must pass `npm run check`, `npm run build`, and `npm run test:run` before being considered complete.**
