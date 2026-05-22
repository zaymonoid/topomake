import { useSelector } from "@zaymonoid/katha/react";
import { useEffect, useRef, useState } from "react";
import { selectSelectedAnnotationId } from "../state/selectors";
import { store } from "../state/store";
import { type Annotation, PALETTE } from "../state/types";

type Props = {
  annotation: Annotation;
  stageRef: React.RefObject<HTMLDivElement>;
};

export function AnnotationPin({ annotation, stageRef }: Props) {
  const selectedId = useSelector(store, selectSelectedAnnotationId);

  const isSelected = selectedId === annotation.id;
  const isNew = isSelected && annotation.text === "";
  const [editing, setEditing] = useState(isNew);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Auto-enter edit mode when this annotation is freshly created (empty text + selected).
  useEffect(() => {
    if (isNew) setEditing(true);
  }, [isNew]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragPointerIdRef.current = e.pointerId;
    draggedRef.current = false;
    store.put({ id: "mode/selectAnnotation", data: { id: annotation.id } });
    // Capture pre-drag snapshot so undo reverts the drag as one step.
    store.put({ id: "history/push", data: store.getState().topo.snapshot });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    if (x !== annotation.x || y !== annotation.y) draggedRef.current = true;
    store.put({ id: "annotations/setPos", data: { id: annotation.id, x, y } });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    dragPointerIdRef.current = null;
    // No drag → treat as a click for editing
    if (!draggedRef.current) setEditing(true);
  };

  const commitText = () => {
    setEditing(false);
    if (annotation.text === "") {
      store.put({ id: "annotations/delete", data: { id: annotation.id } });
    }
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (annotation.text === "") {
        store.put({ id: "annotations/delete", data: { id: annotation.id } });
      } else {
        setEditing(false);
      }
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-positionable annotation pin
    // biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only; editing handled by input below
    <div
      className={`ann-pin ${isSelected ? "selected" : ""} ${annotation.text === "" ? "empty" : ""}`}
      style={{
        left: `${annotation.x * 100}%`,
        top: `${annotation.y * 100}%`,
        color: PALETTE[annotation.color ?? "white"],
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="ann-input"
          value={annotation.text}
          placeholder="annotation…"
          onChange={(e) =>
            store.put({
              id: "annotations/setText",
              data: { id: annotation.id, text: e.target.value },
            })
          }
          onBlur={commitText}
          onKeyDown={onInputKey}
        />
      ) : (
        annotation.text || "annotation…"
      )}
    </div>
  );
}
