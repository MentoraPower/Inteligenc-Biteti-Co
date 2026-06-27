import { useState, useEffect, useCallback, memo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ClipboardList, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

const getSaoPauloTime = () => {
  const now = new Date();
  const saoPauloTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return {
    hora: saoPauloTime.getHours().toString().padStart(2, "0"),
    minuto: saoPauloTime.getMinutes().toString().padStart(2, "0")
  };
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
  const [hora, setHora] = useState("12");
  const [minuto, setMinuto] = useState("00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editingActivity) {
      setTitulo(editingActivity.titulo);
      setTipo(editingActivity.tipo);
      setData(new Date(editingActivity.data + 'T00:00:00'));
      const [h, m] = editingActivity.hora.split(':');
      setHora(h || "12");
      setMinuto(m || "00");
    } else {
      const currentSpTime = getSaoPauloTime();
      setTitulo("");
      setTipo("");
      setData(new Date());
      setHora(currentSpTime.hora);
      setMinuto(currentSpTime.minuto);
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
      hora: `${hora}:${minuto}`,
    }, editingActivity?.id);

    setTimeout(() => {
      onOpenChange(false);
    }, 100);
  }, [titulo, tipo, data, hora, minuto, onAddActivity, onOpenChange, isSubmitting, editingActivity?.id]);

  const isValid = titulo.trim() && tipo && data && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {editingActivity ? "Editar atividade" : "Nova atividade"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {stepName}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título*</label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Ligar para o lead"
              className="h-11"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo*</label>
            <div className="grid grid-cols-4 gap-2">
              {activityTypes.map((typeOption) => {
                const Icon = typeOption.icon;
                const isSelected = tipo === typeOption.id;
                return (
                  <button
                    key={typeOption.id}
                    type="button"
                    onClick={() => setTipo(typeOption.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-lg transition-all duration-200 text-xs",
                      isSelected
                        ? "bg-primary/15 text-primary ring-2 ring-primary/50"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate w-full text-center">{typeOption.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data e hora</label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-left font-normal h-11">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {data ? format(data, "dd/MM/yyyy", { locale: ptBR }) : "DD/MM/AAAA"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data}
                    onSelect={(date) => date && setData(date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground">às</span>

              <Select value={hora} onValueChange={setHora}>
                <SelectTrigger className="w-[70px] h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-muted-foreground">:</span>

              <Select value={minuto} onValueChange={setMinuto}>
                <SelectTrigger className="w-[70px] h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {minutes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full"
        >
          {editingActivity ? "Salvar" : "Criar atividade"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export const AddActivityDialog = memo(AddActivityDialogComponent);
