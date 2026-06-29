import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Copy, Check, X, Code, MoreVertical, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface CustomField {
  id: string;
  sub_origin_id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  options: unknown;
  ordem: number;
  is_required: boolean;
}

interface CustomFieldsPanelProps {
  subOriginId: string;
  isOpen: boolean;
  onClose: () => void;
  onFieldsChange?: () => void;
}

export function CustomFieldsPanel({ subOriginId, isOpen, onClose, onFieldsChange }: CustomFieldsPanelProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [tab, setTab] = useState<"existing" | "new">("existing");
  
  const [newField, setNewField] = useState({
    field_label: "",
    field_type: "text",
    options: "",
  });
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const generateWebhookModel = () => {
    const model: Record<string, string> = {};
    fields.forEach(field => {
      switch (field.field_type) {
        case "number":
          model[field.id] = "123";
          break;
        case "boolean":
          model[field.id] = "true";
          break;
        case "select":
          const options = field.options as string[] | null;
          model[field.id] = options?.[0] || "opcao";
          break;
        case "file":
          model[field.id] = "data:image/png;base64,iVBOR...ou qualquer base64";
          break;
        default:
          model[field.id] = "valor";
      }
    });
    return JSON.stringify({ custom_fields: model }, null, 2);
  };

  const copyWebhookModel = () => {
    const model = generateWebhookModel();
    navigator.clipboard.writeText(model);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
    toast.success("Modelo copiado!");
  };

  const fetchFields = async () => {
    const { data, error } = await supabase
      .from("sub_origin_custom_fields")
      .select("*")
      .eq("sub_origin_id", subOriginId)
      .order("ordem");

    if (error) {
      console.error("Error fetching custom fields:", error);
      return;
    }

    setFields(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchFields();
    }
  }, [subOriginId, isOpen]);

  const generateFieldKey = (label: string) => {
    return label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const handleAddField = async () => {
    if (!newField.field_label) {
      toast.error("Preencha o nome do campo");
      return;
    }

    const fieldKey = generateFieldKey(newField.field_label);
    const options = newField.field_type === "select" && newField.options
      ? newField.options.split(",").map(o => o.trim()).filter(Boolean)
      : null;

    const { data, error } = await supabase
      .from("sub_origin_custom_fields")
      .insert({
        sub_origin_id: subOriginId,
        field_key: fieldKey,
        field_label: newField.field_label,
        field_type: newField.field_type,
        is_required: false,
        options,
        ordem: fields.length,
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar campo");
      return;
    }

    setFields([...fields, data]);
    setNewField({
      field_label: "",
      field_type: "text",
      options: "",
    });
    toast.success("Campo criado!");
    onFieldsChange?.();
  };

  const handleDeleteField = async (fieldId: string) => {
    const { error } = await supabase
      .from("sub_origin_custom_fields")
      .delete()
      .eq("id", fieldId);

    if (error) {
      toast.error("Erro ao excluir campo");
      return;
    }

    setFields(fields.filter(f => f.id !== fieldId));
    toast.success("Campo excluído");
    onFieldsChange?.();
  };

  const startEditField = (field: CustomField) => {
    setEditingFieldId(field.id);
    setEditingLabel(field.field_label);
  };

  const handleSaveEditField = async (fieldId: string) => {
    const label = editingLabel.trim();
    if (!label) return;
    const { error } = await supabase
      .from("sub_origin_custom_fields")
      .update({ field_label: label })
      .eq("id", fieldId);

    if (error) {
      toast.error("Erro ao atualizar campo");
      return;
    }

    setFields(fields.map(f => (f.id === fieldId ? { ...f, field_label: label } : f)));
    setEditingFieldId(null);
    toast.success("Campo atualizado");
    onFieldsChange?.();
  };

  const copyFieldId = (fieldId: string) => {
    navigator.clipboard.writeText(fieldId);
    setCopiedId(fieldId);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("ID copiado!");
  };

  const getFieldTypeLabel = (type: string) => {
    switch (type) {
      case "text": return "Texto";
      case "number": return "Número";
      case "select": return "Seleção";
      case "boolean": return "Sim/Não";
      case "file": return "Arquivo";
      default: return type;
    }
  };

  return (
    <div 
      className={`flex-shrink-0 bg-background border-l border-border h-full overflow-hidden rounded-t-xl rounded-b-xl transition-all duration-300 ease-out ${
        isOpen 
          ? 'w-[420px] opacity-100' 
          : 'w-0 opacity-0 border-l-0'
      }`}
    >
      <div className="w-[420px] h-full overflow-y-auto">
      <div className="sticky top-0 bg-background z-10 p-5 border-b border-border rounded-t-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg tracking-tight">Campos Personalizados</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl">
          <button
            onClick={() => setTab("existing")}
            className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${
              tab === "existing" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Campos existentes
          </button>
          <button
            onClick={() => setTab("new")}
            className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${
              tab === "new" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Adicionar
          </button>
        </div>

        {tab === "existing" && fields.length > 0 && (
          <Button
            variant="outline"
            className="w-full gap-2 text-sm h-10 rounded-lg"
            onClick={copyWebhookModel}
          >
            {copiedWebhook ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-500" />
                Copiado!
              </>
            ) : (
              <>
                <Code className="h-3.5 w-3.5" />
                Copiar modelo webhook
              </>
            )}
          </Button>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Existing fields tab */}
        {tab === "existing" && (
        <div className="space-y-2.5">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : fields.length === 0 ? (
            <div className="text-sm text-muted-foreground italic py-2">
              Nenhum campo criado ainda
            </div>
          ) : (
            <div className="space-y-2.5">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="p-3.5 bg-zinc-500/[0.06] rounded-xl"
                >
                  {/* Top row: type (front) + name (or inline edit) + kebab */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground px-2 py-1 bg-muted rounded-md flex-shrink-0">
                      {getFieldTypeLabel(field.field_type)}
                    </span>

                    {editingFieldId === field.id ? (
                      <Input
                        value={editingLabel}
                        autoFocus
                        onChange={(e) => setEditingLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEditField(field.id);
                          if (e.key === "Escape") setEditingFieldId(null);
                        }}
                        onBlur={() => handleSaveEditField(field.id)}
                        className="h-8 flex-1 rounded-lg text-sm"
                      />
                    ) : (
                      <span className="flex-1 min-w-0 font-semibold text-[15px] truncate">{field.field_label}</span>
                    )}

                    {editingFieldId === field.id ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0 rounded-lg text-green-600"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSaveEditField(field.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 rounded-lg">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[150px] rounded-xl">
                          <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg" onClick={() => startEditField(field)}>
                            <Pencil className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer rounded-lg text-destructive focus:text-destructive"
                            onClick={() => handleDeleteField(field.id)}
                          >
                            <Trash2 className="h-4 w-4" /> Apagar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* ID row: click to copy */}
                  <button
                    type="button"
                    onClick={() => copyFieldId(field.id)}
                    title="Copiar ID"
                    className="mt-1.5 flex items-center gap-1.5 max-w-full text-left group/id"
                  >
                    <span className="text-xs text-muted-foreground truncate font-mono group-hover/id:text-foreground transition-colors">
                      {field.id}
                    </span>
                    {copiedId === field.id ? (
                      <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Add new field tab */}
        {tab === "new" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Nome do campo</Label>
            <Input
              placeholder="Ex: Profissão"
              value={newField.field_label}
              onChange={(e) => setNewField({ ...newField, field_label: e.target.value })}
              className="h-12 rounded-lg text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Tipo</Label>
            <Select
              value={newField.field_type}
              onValueChange={(value) => setNewField({ ...newField, field_type: value })}
            >
              <SelectTrigger className="h-12 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="number">Número</SelectItem>
                <SelectItem value="select">Seleção</SelectItem>
                <SelectItem value="boolean">Sim/Não</SelectItem>
                <SelectItem value="file">Arquivo (Comprovante)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {newField.field_type === "select" && (
            <div className="space-y-2">
              <Label className="text-sm">Opções (separadas por vírgula)</Label>
              <Input
                placeholder="Opção 1, Opção 2, Opção 3"
                value={newField.options}
                onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                className="h-12 rounded-lg text-sm"
              />
            </div>
          )}

          <Button
            onClick={handleAddField}
            className="w-full gap-2 h-12 rounded-lg text-sm font-semibold bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" />
            Adicionar Campo
          </Button>
        </div>
        )}
      </div>
      </div>
    </div>
  );
}
