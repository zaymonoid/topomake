// Returns a predicate that's true when the user is typing in an editable field.
// Shortcut callbacks should bail early if this returns true so typing in inputs doesn't fire commands.
export function isTypingInField(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}
