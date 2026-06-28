import { useState, useEffect, useCallback, memo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ClipboardList, Phone, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { LeadActivity } from "@/hooks/use-lead-activities";

interface AddActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepName: string;
  onAddActivity: (activity: {
    titulo: string;
    tipo: string;
    data: Date;
    hora: string;
  }, editingActivityId?: string) => void;
  editingActivity?: LeadActivity | null;
}

const activityTypes = [
  { id: "tarefas", label: "Tarefas", icon: ClipboardList },
  { id: "ligacao", label: "Ligação", icon: Phone },
] as const;

// Insert ":" as the user types (digits only) — no clamping while typing.
const maskTime = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 6);
  let out = d.slice(0, 2);
  if (d.length > 2) out += ":" + d.slice(2, 4);
  if (d.length > 4) out += ":" + d.slice(4, 6);
  return out;
};

// Normalize to a valid full HH:MM:SS, clamping each part (no errors).
const normalizeTime = (s: string) => {
  const d = s.replace(/\D/g, "").padEnd(6, "0").slice(0, 6);
  const hh = Math.min(23, parseInt(d.slice(0, 2), 10) || 0);
  const mm = Math.min(59, parseInt(d.slice(2, 4), 10) || 0);
  const ss = Math.min(59, parseInt(d.slice(4, 6), 10) || 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)}`;
};

const getSaoPauloTime = () => {
  const now = new Date();
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(sp.getHours())}:${p(sp.getMinutes())}:${p(sp.getSeconds())}`;
};

function AddActivityDialogComponent({
  open,
  onOpenChange,
  stepName,
  onAddActivity,
  editingActivity,
}: AddActivityDialogProps) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [data, setData] = useState<Date>(new Date());
  const [hora, setHora] = useState("12:00:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editingActivity) {
      setTitulo(editingActivity.titulo);
      setTipo(editingActivity.tipo);
      setData(new Date(editingActivity.data + 'T00:00:00'));
      setHora(normalizeTime(editingActivity.hora || ""));
    } else {
      setTitulo("");
      setTipo("");
      setData(new Date());
      setHora(getSaoPauloTime());
    }
    setIsSubmitting(false);
  }, [open, editingActivity]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (isSubmitting) return;
    onOpenChange(newOpen);
  }, [onOpenChange, isSubmitting]);

  const handleSubmit = useCallback(() => {
    if (!titulo.trim() || !tipo || !data || isSubmitting) return;

    setIsSubmitting(true);

    onAddActivity({
      titulo: titulo.trim(),
      tipo,
      data,
      hora: normalizeTime(hora),
    }, editingActivity?.id);

    setTimeout(() => {
      onOpenChange(false);
    }, 100);
  }, [titulo, tipo, data, hora, onAddActivity, onOpenChange, isSubmitting, editingActivity?.id]);

  const isValid = titulo.trim() && tipo && data && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold">
            {editingActivity ? "Editar atividade" : "Nova atividade"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{stepName}</p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {/* Título */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Título *</label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Ligar para o lead"
              className="h-11 rounded-xl"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo *</label>
            <div className="grid grid-cols-2 gap-2.5">
              {activityTypes.map((typeOption) => {
                const Icon = typeOption.icon;
                const isSelected = tipo === typeOption.id;
                return (
                  <button
                    key={typeOption.id}
                    type="button"
                    onClick={() => setTipo(typeOption.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 h-12 rounded-xl border text-sm font-medium transition-all",
                      isSelected
                        ? "border-foreground bg-foreground/[0.04] text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {typeOption.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data e hora */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Data e hora</label>
            <div className="flex items-stretch gap-2.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-left font-normal h-11 rounded-xl">
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {data ? format(data, "dd/MM/yyyy", { locale: ptBR }) : "DD/MM/AAAA"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[99999]" align="start">
                  <Calendar
                    mode="single"
                    selected={data}
                    onSelect={(date) => date && setData(date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Masked time input — type digits, auto "00:00:00" */}
              <div className="relative w-[150px]">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={hora}
                  onChange={(e) => setHora(maskTime(e.target.value))}
                  onBlur={() => setHora(normalizeTime(hora))}
                  placeholder="00:00:00"
                  inputMode="numeric"
                  className="h-11 rounded-xl pl-9 text-center font-mono tracking-wider"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-1">
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            className="w-full h-11 rounded-xl bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100 shadow-sm font-semibold"
          >
            {editingActivity ? "Salvar" : "Criar atividade"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const AddActivityDialog = memo(AddActivityDialogComponent);
