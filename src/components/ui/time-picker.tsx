import { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "");
    
    // Limit to 4 digits
    const limited = digits.slice(0, 4);
    
    // Format as HH:MM while typing
    let formatted = "";
    if (limited.length === 0) {
      formatted = "";
    } else if (limited.length <= 2) {
      formatted = limited;
    } else {
      formatted = `${limited.slice(0, 2)}:${limited.slice(2)}`;
    }
    
    setInputValue(formatted);
    
    // Only call onChange when we have a complete time
    if (limited.length === 4) {
      const hours = Math.min(parseInt(limited.slice(0, 2), 10), 23);
      const minutes = Math.min(parseInt(limited.slice(2, 4), 10), 59);
      const validTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      onChange(validTime);
    }
  };

  const handleBlur = () => {
    const digits = inputValue.replace(/\D/g, "");
    
    if (digits.length === 0) {
      setInputValue(value);
      return;
    }
    
    let hours = 0;
    let minutes = 0;
    
    if (digits.length === 1) {
      hours = parseInt(digits, 10);
    } else if (digits.length === 2) {
      hours = parseInt(digits, 10);
    } else if (digits.length === 3) {
      hours = parseInt(digits.slice(0, 1), 10);
      minutes = parseInt(digits.slice(1, 3), 10);
    } else {
      hours = parseInt(digits.slice(0, 2), 10);
      minutes = parseInt(digits.slice(2, 4), 10);
    }
    
    hours = Math.min(Math.max(hours, 0), 23);
    minutes = Math.min(Math.max(minutes, 0), 59);
    
    const formatted = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    setInputValue(formatted);
    onChange(formatted);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 h-8 px-3 rounded-md bg-muted/50 hover:bg-muted transition-colors",
        "focus-within:ring-2 focus-within:ring-primary/20",
        className
      )}
    >
      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="00:00"
        className="w-12 bg-transparent text-sm font-medium tabular-nums text-center focus:outline-none"
      />
    </div>
  );
}
