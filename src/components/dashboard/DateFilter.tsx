import { useState } from "react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type DateRange = {
  from: Date;
  to: Date;
};

export type FilterPreset = "today" | "yesterday" | "last7days" | "last30days" | "custom";

interface DateFilterProps {
  onDateChange: (range: DateRange) => void;
}

const presets: { label: string; value: FilterPreset }[] = [
  { label: "Hoje", value: "today" },
  { label: "Ontem", value: "yesterday" },
  { label: "Últimos 7 dias", value: "last7days" },
  { label: "Últimos 30 dias", value: "last30days" },
];

export default function DateFilter({ onDateChange }: DateFilterProps) {
  const [selectedPreset, setSelectedPreset] = useState<FilterPreset>("last30days");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({});

  const getPresetRange = (preset: FilterPreset): DateRange => {
    const now = new Date();
    switch (preset) {
      case "today":
        return { from: startOfDay(now), to: endOfDay(now) };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
      case "last7days":
        return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
      case "last30days":
        return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
      default:
        return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    }
  };

  const handlePresetClick = (preset: FilterPreset) => {
    setSelectedPreset(preset);
    setCustomRange(null);
    const range = getPresetRange(preset);
    onDateChange(range);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;

    if (!tempRange.from || (tempRange.from && tempRange.to)) {
      // Start new selection
      setTempRange({ from: date, to: undefined });
    } else {
      // Complete selection
      const from = tempRange.from;
      const to = date;
      
      // Ensure from is before to
      const finalRange: DateRange = from <= to 
        ? { from: startOfDay(from), to: endOfDay(to) }
        : { from: startOfDay(to), to: endOfDay(from) };
      
      setCustomRange(finalRange);
      setSelectedPreset("custom");
      setTempRange({});
      setIsCalendarOpen(false);
      onDateChange(finalRange);
    }
  };

  const getDisplayLabel = () => {
    if (selectedPreset === "custom" && customRange) {
      return `${format(customRange.from, "dd/MM/yy")} - ${format(customRange.to, "dd/MM/yy")}`;
    }
    return presets.find(p => p.value === selectedPreset)?.label || "Filtrar";
  };

  const getSelectedDates = () => {
    if (tempRange.from && tempRange.to) {
      return { from: tempRange.from, to: tempRange.to };
    }
    if (tempRange.from) {
      return { from: tempRange.from, to: tempRange.from };
    }
    if (customRange) {
      return customRange;
    }
    return undefined;
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Preset buttons */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border/30 dark:border-white/[0.06]">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset.value)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              selectedPreset === preset.value
                ? "bg-white dark:bg-white/10 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom date range picker */}
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 px-3 gap-2 border-border/30 dark:border-white/[0.06] bg-white dark:bg-white/[0.05] hover:bg-muted/50",
              selectedPreset === "custom" && "border-primary/50 bg-primary/5"
            )}
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {selectedPreset === "custom" && customRange
                ? getDisplayLabel()
                : "Personalizado"}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 border-b">
            <p className="text-sm font-medium text-foreground">Selecionar período</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tempRange.from && !tempRange.to
                ? `Início: ${format(tempRange.from, "dd/MM/yyyy")} - Selecione o fim`
                : "Clique para selecionar início e fim"}
            </p>
          </div>
          <Calendar
            mode="range"
            selected={getSelectedDates()}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                const finalRange: DateRange = {
                  from: startOfDay(range.from),
                  to: endOfDay(range.to)
                };
                setCustomRange(finalRange);
                setSelectedPreset("custom");
                setTempRange({});
                setIsCalendarOpen(false);
                onDateChange(finalRange);
              } else if (range?.from) {
                setTempRange({ from: range.from });
              }
            }}
            numberOfMonths={2}
            locale={ptBR}
            className="p-3 pointer-events-auto"
            disabled={(date) => date > new Date()}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
