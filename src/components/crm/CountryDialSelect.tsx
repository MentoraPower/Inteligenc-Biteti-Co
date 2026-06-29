import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { countries, findCountryByDial, getFlagSvgUrl } from "@/data/countries";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountryDialSelectProps {
  value?: string | null; // dial code, e.g. "+55"
  onChange: (dialCode: string) => void;
}

export function CountryDialSelect({ value, onChange }: CountryDialSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = findCountryByDial(value) || findCountryByDial("+55");

  const filtered = countries.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 flex-shrink-0 rounded-md px-1 -ml-1 py-0.5 hover:bg-muted/60 transition-colors outline-none"
        >
          {selected && (
            <img
              src={getFlagSvgUrl(selected.code)}
              alt=""
              className="w-5 h-[14px] rounded-[2px] object-cover ring-1 ring-black/5"
            />
          )}
          <span className="text-[15px] font-medium text-muted-foreground">{selected?.dialCode || value}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 z-[9999] rounded-xl overflow-hidden" align="start">
        <div className="p-2 border-b border-border">
          <Input
            placeholder="Buscar país..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm rounded-lg"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto kanban-scroll">
          {filtered.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => { onChange(c.dialCode); setOpen(false); setSearch(""); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 text-left transition-colors",
                selected?.code === c.code && "bg-muted"
              )}
            >
              <img
                src={getFlagSvgUrl(c.code)}
                alt=""
                className="w-5 h-[14px] rounded-[2px] object-cover ring-1 ring-black/5 flex-shrink-0"
              />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-muted-foreground">{c.dialCode}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhum país encontrado</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
