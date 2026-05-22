import { useSelector } from "@zaymonoid/katha/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { selectTopo } from "../state/selectors";
import { store } from "../state/store";
import { newTopoId } from "../util/id";
import { deleteTopo, listTopos, loadTopo, type TopoMeta } from "../util/storage";

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

const loadAndDispatch = async (id: string) => {
  const record = await loadTopo(id);
  if (!record) return;
  store.put({
    id: "topo/loadFrom",
    data: {
      id: record.id,
      name: record.name,
      image: record.image,
      display: record.display,
      metadata: record.metadata,
      snapshot: record.snapshot,
    },
  });
  store.put({
    id: "history/restore",
    data: { past: record.history.past, future: record.history.future },
  });
};

export function TopoPicker() {
  const currentTopo = useSelector(store, selectTopo);
  const currentId = currentTopo.id;

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
    if (id !== currentId) await loadAndDispatch(id);
    setOpen(false);
  };

  const onNew = () => {
    store.put({ id: "topo/new", data: { id: newTopoId() } });
    setOpen(false);
  };

  const onDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this topo? This can't be undone.")) return;
    await deleteTopo(id);
    // If we just deleted the current topo, fall through to the next one or
    // a fresh blank.
    if (id === currentId) {
      const remaining = await listTopos();
      if (remaining.length > 0) {
        await loadAndDispatch(remaining[0].id);
      } else {
        store.put({ id: "topo/new", data: { id: newTopoId() } });
      }
    }
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
