// Single source of truth for keyboard shortcuts.
// Handlers in src/input/shortcuts/ match against `key`; UI tooltips render `label`.

export type Shortcut = {
  key: string;
  label: string;
  meta?: boolean;
  shift?: boolean;
};

export const SHORTCUTS = {
  select: { key: "v", label: "V" },
  draw: { key: "r", label: "R" },
  annotate: { key: "t", label: "T" },
  branch: { key: "b", label: "B" },
  undo: { key: "z", label: "⌘Z", meta: true },
  redo: { key: "z", label: "⌘⇧Z", meta: true, shift: true },
} as const satisfies Record<string, Shortcut>;
