import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { currentTopoIdAtom } from "../state/atoms";
import { deleteTopoActionAtom, loadTopoActionAtom, newTopoActionAtom } from "../state/persistence";
import { listTopos, type TopoMeta } from "../util/storage";

// TODO: (Zaymonoid): Use date-fns?
function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function TopoPicker() {
  const currentId = useAtomValue(currentTopoIdAtom);
  const loadTopo = useSetAtom(loadTopoActionAtom);
  const newTopo = useSetAtom(newTopoActionAtom);
  const deleteTopoAction = useSetAtom(deleteTopoActionAtom);

  const [open, setOpen] = useState(false);
  const [metas, setMetas] = useState<TopoMeta[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setMetas(await listTopos());
    } catch (err) {
      console.error("[picker] list failed", err);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refresh]);

  const onPick = async (id: string) => {
    if (id !== currentId) await loadTopo(id);
    setOpen(false);
  };

  const onNew = () => {
    newTopo();
    setOpen(false);
  };

  const onDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this topo? This can't be undone.")) return;
    await deleteTopoAction(id);
    refresh();
  };

  return (
    <div className="topo-picker" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Topos"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 4 H14" />
          <path d="M2 8 H14" />
          <path d="M2 12 H14" />
        </svg>
        <span className="tip">Topos</span>
      </button>
      {open && (
        <div className="topo-popover" role="menu">
          <button type="button" className="topo-popover-new" onClick={onNew}>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M8 3 V13 M3 8 H13" />
            </svg>
            <span>New topo</span>
          </button>
          <div className="topo-popover-divider" />
          {metas.length === 0 ? (
            <div className="topo-popover-empty">No saved topos yet</div>
          ) : (
            <div className="topo-popover-list">
              {metas.map((m) => (
                <div
                  key={m.id}
                  className={`topo-popover-row ${m.id === currentId ? "current" : ""}`}
                  onClick={() => onPick(m.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick(m.id);
                    }
                  }}
                  role="menuitem"
                  tabIndex={0}
                >
                  <div className="topo-popover-info">
                    <div className="topo-popover-name">{m.name || "Untitled Topo"}</div>
                    <div className="topo-popover-meta">{formatRelative(m.updatedAt)}</div>
                  </div>
                  <button
                    type="button"
                    className="topo-popover-del"
                    onClick={(e) => onDelete(e, m.id)}
                    aria-label="Delete topo"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M4 5 H12 M6 5 V3 H10 V5 M5 5 L6 13 H10 L11 5" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
