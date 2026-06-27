import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EditableField } from "./EditableField";
import { FilePreview } from "./FilePreview";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import * as LucideIcons from "lucide-react";

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

interface CustomFieldResponse {
  id: string;
  lead_id: string;
  field_id: string;
  response_value: string | null;
}

interface LeadCustomFieldsProps {
  leadId: string;
  subOriginId: string | null;
  onOpenManager?: () => void;
  refreshTrigger?: number;
}

export function LeadCustomFields({ leadId, subOriginId, onOpenManager, refreshTrigger }: LeadCustomFieldsProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    if (!subOriginId) {
      setIsLoading(false);
      return;
    }

    const { data: fieldsData, error: fieldsError } = await supabase
      .from("sub_origin_custom_fields")
      .select("*")
      .eq("sub_origin_id", subOriginId)
      .order("ordem");

    if (fieldsError) {
      console.error("Error fetching custom fields:", fieldsError);
      setIsLoading(false);
      return;
    }

    setFields(fieldsData || []);

    if (fieldsData && fieldsData.length > 0) {
      const { data: responsesData, error: responsesError } = await supabase
        .from("lead_custom_field_responses")
        .select("*")
        .eq("lead_id", leadId);

      if (responsesError) {
        console.error("Error fetching responses:", responsesError);
      } else {
        const responsesMap: Record<string, string> = {};
        (responsesData || []).forEach((r: CustomFieldResponse) => {
          responsesMap[r.field_id] = r.response_value || "";
        });
        setResponses(responsesMap);
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [leadId, subOriginId, refreshTrigger]);

  const handleUpdateField = async (fieldId: string, value: string) => {
    const { data: existing } = await supabase
      .from("lead_custom_field_responses")
      .select("id")
      .eq("lead_id", leadId)
      .eq("field_id", fieldId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("lead_custom_field_responses")
        .update({ response_value: value })
        .eq("id", existing.id);

      if (error) {
        toast.error("Erro ao atualizar campo");
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("lead_custom_field_responses")
        .insert({
          lead_id: leadId,
          field_id: fieldId,
          response_value: value,
        });

      if (error) {
        toast.error("Erro ao salvar campo");
        throw error;
      }
    }

    setResponses({ ...responses, [fieldId]: value });
    toast.success("Campo atualizado");
  };

  const formatDisplayValue = (field: CustomField, value: string | null | undefined) => {
    if (!value || value.trim() === "") {
      return <span className="text-sm font-semibold text-muted-foreground italic">incompleto</span>;
    }

    if (field.field_type === "boolean") {
      return <span className="text-sm font-semibold">{value === "true" ? "Sim" : "Não"}</span>;
    }

    if (field.field_type === "number") {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return <span className="text-sm font-semibold">{num.toLocaleString("pt-BR")}</span>;
      }
    }

    return <span className="text-sm font-semibold">{value}</span>;
  };

  const getFieldIcon = (field: CustomField) => {
    switch (field.field_type) {
      case "number":
        return <LucideIcons.Hash className="h-4 w-4 text-muted-foreground" />;
      case "boolean":
        return <LucideIcons.ToggleLeft className="h-4 w-4 text-muted-foreground" />;
      case "select":
        return <LucideIcons.List className="h-4 w-4 text-muted-foreground" />;
      case "file":
        return <LucideIcons.Paperclip className="h-4 w-4 text-muted-foreground" />;
      default:
        return <LucideIcons.Type className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Campos Personalizados</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!subOriginId) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Campos Personalizados</h3>
        
        {onOpenManager && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={onOpenManager}
          >
            <Settings2 className="h-4 w-4" />
            Gerenciar Campos
          </Button>
        )}
      </div>

      {fields.length === 0 ? (
        <div className="text-sm text-muted-foreground italic py-4 text-center border border-dashed border-border rounded-lg">
          Nenhum campo personalizado. {onOpenManager && "Clique em \"Gerenciar Campos\" para adicionar."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((field, index) => {
            const value = responses[field.id] || "";
            const isFileField = field.field_type === "file";
            const hasFileUrl = isFileField && value && (value.startsWith("http://") || value.startsWith("https://"));
            
            return (
              <div 
                key={field.id} 
                className="p-3 bg-muted/30 border border-[#00000010] rounded-lg animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  {getFieldIcon(field)}
                  <p className="text-xs font-semibold text-muted-foreground">
                    {field.field_label}
                    {field.is_required && <span className="text-destructive ml-1">*</span>}
                  </p>
                </div>
                {hasFileUrl ? (
                  <FilePreview url={value} />
                ) : isFileField && !value ? (
                  <span className="text-sm font-medium text-muted-foreground italic">sem arquivo</span>
                ) : (
                  <EditableField
                    value={value}
                    onSave={(newValue) => handleUpdateField(field.id, newValue)}
                    placeholder={`Digite ${field.field_label.toLowerCase()}`}
                    displayValue={formatDisplayValue(field, value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}