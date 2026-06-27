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
import { Plus, Trash2, Copy, Check, X, Code } from "lucide-react";


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
  
  const [newField, setNewField] = useState({
    field_label: "",
    field_type: "text",
    options: "",
  });

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
          ? 'w-80 opacity-100' 
          : 'w-0 opacity-0 border-l-0'
      }`}
    >
      <div className="w-80 h-full overflow-y-auto">
      <div className="sticky top-0 bg-background z-10 p-4 border-b border-border rounded-t-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Campos Personalizados</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use o ID do campo no webhook
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {fields.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full gap-2 text-xs"
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

      <div className="p-4 space-y-4">
        {/* Existing fields list */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Campos existentes
          </h4>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : fields.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-2">
              Nenhum campo criado ainda
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{field.field_label}</div>
                    <div className="text-[10px] text-muted-foreground truncate font-mono">
                      {field.id}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                    {getFieldTypeLabel(field.field_type)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={() => copyFieldId(field.id)}
                  >
                    {copiedId === field.id ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteField(field.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new field form */}
        <div className="pt-4 border-t border-border space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Adicionar novo campo
          </h4>
          
          <div className="space-y-2">
            <Label className="text-xs">Nome do campo</Label>
            <Input
              placeholder="Ex: Profissão"
              value={newField.field_label}
              onChange={(e) => setNewField({ ...newField, field_label: e.target.value })}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={newField.field_type}
              onValueChange={(value) => setNewField({ ...newField, field_type: value })}
            >
              <SelectTrigger className="h-9">
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
              <Label className="text-xs">Opções (separadas por vírgula)</Label>
              <Input
                placeholder="Opção 1, Opção 2, Opção 3"
                value={newField.options}
                onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                className="h-9"
              />
            </div>
          )}

          <Button onClick={handleAddField} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Campo
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
