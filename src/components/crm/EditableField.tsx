import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import { useUndo } from "@/contexts/UndoContext";

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  displayValue?: React.ReactNode;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function EditableField({
  value,
  onSave,
  displayValue,
  placeholder = "",
  className = "",
  inputClassName = "",
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { pushAction } = useUndo();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const oldValue = value;
    const newValue = editValue;
    try {
      await onSave(newValue);
      setIsEditing(false);
      // Register for Cmd+Z / Cmd+Y
      pushAction({
        label: "Editar campo",
        undo: () => onSave(oldValue),
        redo: () => onSave(newValue),
      });
    } catch (error) {
      console.error("Error saving field:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  // A single, fixed-size container is kept for BOTH states. Only the inner content
  // swaps (text span ↔ transparent input). The input inherits the exact font and
  // line-height, so clicking to edit never shifts the layout or resizes the text.
  return (
    <div
      onClick={isEditing ? undefined : () => setIsEditing(true)}
      className={`leading-tight ${isEditing ? "" : "cursor-text"} ${className}`}
    >
      {isEditing ? (
        <Input
          ref={inputRef}
          data-undo-native
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          disabled={isSaving}
          className={`block h-auto w-full p-0 m-0 border-0 shadow-none bg-transparent rounded-none leading-tight focus-visible:ring-0 focus-visible:ring-offset-0 ${inputClassName}`}
        />
      ) : (
        displayValue
      )}
    </div>
  );
}
