import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
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
}

const UndoContext = createContext<UndoContextValue | null>(null);

const MAX_HISTORY = 50;

export function UndoProvider({ children }: { children: React.ReactNode }) {
  // Everything is kept in refs so registering/undoing an action NEVER re-renders
  // the provider (and therefore never re-renders the whole app tree mid-drag).
  const undoStack = useRef<UndoableAction[]>([]);
  const redoStack = useRef<UndoableAction[]>([]);
  const busy = useRef(false);

  const pushAction = useCallback((action: UndoableAction) => {
    undoStack.current.push(action);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    // A new action invalidates the redo history.
    redoStack.current = [];
  }, []);

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
    }
  }, []);

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
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      // Only let the browser's native undo win inside fields where the user is
      // editing actual content (textarea, contentEditable, or an input that opts
      // in via data-undo-native). A plain filter/search input must NOT block it.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const nativeUndo =
        tag === "TEXTAREA" ||
        !!target?.isContentEditable ||
        !!target?.closest?.("[data-undo-native]");
      if (nativeUndo) return;

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

  // Stable value — identity never changes, so consumers never re-render from undo.
  const value = useMemo(() => ({ pushAction, undo, redo }), [pushAction, undo, redo]);

  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>;
}

// Safe to call outside the provider — returns a no-op so components don't crash.
const NOOP: UndoContextValue = { pushAction: () => {}, undo: () => {}, redo: () => {} };

export function useUndo(): UndoContextValue {
  return useContext(UndoContext) ?? NOOP;
}
