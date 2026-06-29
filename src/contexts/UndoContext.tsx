import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface UndoableAction {
  label: string;
  // Revert the action (called on Cmd+Z)
  undo: () => void | Promise<void>;
  // Re-apply the action (called on Cmd+Y / Cmd+Shift+Z)
  redo: () => void | Promise<void>;
}

interface UndoContextValue {
  pushAction: (action: UndoableAction) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const UndoContext = createContext<UndoContextValue | null>(null);

const MAX_HISTORY = 50;

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const undoStack = useRef<UndoableAction[]>([]);
  const redoStack = useRef<UndoableAction[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const busy = useRef(false);

  const sync = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const pushAction = useCallback((action: UndoableAction) => {
    undoStack.current.push(action);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    // A new action invalidates the redo history.
    redoStack.current = [];
    sync();
  }, [sync]);

  const undo = useCallback(async () => {
    if (busy.current) return;
    const action = undoStack.current.pop();
    if (!action) return;
    busy.current = true;
    try {
      await action.undo();
      redoStack.current.push(action);
      toast.success(`Desfeito: ${action.label}`, { duration: 1800 });
    } catch (e) {
      console.error("Undo failed:", e);
      undoStack.current.push(action); // restore on failure
      toast.error("Não foi possível desfazer");
    } finally {
      busy.current = false;
      sync();
    }
  }, [sync]);

  const redo = useCallback(async () => {
    if (busy.current) return;
    const action = redoStack.current.pop();
    if (!action) return;
    busy.current = true;
    try {
      await action.redo();
      undoStack.current.push(action);
      toast.success(`Refeito: ${action.label}`, { duration: 1800 });
    } catch (e) {
      console.error("Redo failed:", e);
      redoStack.current.push(action);
      toast.error("Não foi possível refazer");
    } finally {
      busy.current = false;
      sync();
    }
  }, [sync]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      // Don't hijack undo/redo inside text inputs (let the field handle its own).
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (isEditable) return;

      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <UndoContext.Provider value={{ pushAction, undo, redo, canUndo, canRedo }}>
      {children}
    </UndoContext.Provider>
  );
}

// Safe to call outside the provider — returns a no-op so components don't crash.
export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext);
  if (!ctx) {
    return {
      pushAction: () => {},
      undo: () => {},
      redo: () => {},
      canUndo: false,
      canRedo: false,
    };
  }
  return ctx;
}
