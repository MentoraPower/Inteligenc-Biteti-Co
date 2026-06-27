import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Save, FileDown, Trash2, Clock, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  fields: any[];
  is_sequential: boolean;
  created_at: string;
}

interface OnboardingField {
  id: string;
  form_id: string;
  field_type: string;
  title: string;
  description: string | null;
  options: any;
  is_required: boolean;
  ordem: number;
}

interface FormTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "save" | "load";
  currentFields: OnboardingField[];
  isSequential: boolean;
  onApplyTemplate: (fields: any[], isSequential: boolean) => void;
}

export function FormTemplateDialog({
  open,
  onOpenChange,
  mode,
  currentFields,
  isSequential,
  onApplyTemplate,
}: FormTemplateDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, currentWorkspace?.id]);

  const fetchTemplates = async () => {
    if (!currentWorkspace?.id) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from("onboarding_form_templates")
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching templates:", error);
      toast.error("Erro ao carregar modelos");
    } else {
      // Parse fields from JSONB
      const parsedTemplates = (data || []).map(t => ({
        ...t,
        fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields
      }));
      setTemplates(parsedTemplates);
    }
    setIsLoading(false);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Digite um nome para o modelo");
      return;
    }

    if (currentFields.length === 0) {
      toast.error("Adicione pelo menos um campo antes de salvar");
      return;
    }

    if (!currentWorkspace?.id) {
      toast.error("Workspace não encontrado");
      return;
    }

    setIsSaving(true);

    // Prepare fields for storage (remove form_id and id as they're form-specific)
    const fieldsForTemplate = currentFields.map(({ id, form_id, ...rest }) => rest);

    const { error } = await supabase
      .from("onboarding_form_templates")
      .insert({
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        fields: fieldsForTemplate,
        is_sequential: isSequential,
        workspace_id: currentWorkspace.id,
      });

    if (error) {
      console.error("Error saving template:", error);
      toast.error("Erro ao salvar modelo");
    } else {
      toast.success("Modelo salvo com sucesso!");
      setTemplateName("");
      setTemplateDescription("");
      onOpenChange(false);
    }
    setIsSaving(false);
  };

  const handleApplyTemplate = (template: FormTemplate) => {
    onApplyTemplate(template.fields, template.is_sequential);
    onOpenChange(false);
    toast.success(`Modelo "${template.name}" aplicado!`);
  };

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { error } = await supabase
      .from("onboarding_form_templates")
      .delete()
      .eq("id", templateId);

    if (error) {
      toast.error("Erro ao excluir modelo");
    } else {
      setTemplates(templates.filter(t => t.id !== templateId));
      toast.success("Modelo excluído");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "save" ? (
              <>
                <Save className="h-5 w-5" />
                Salvar como Modelo
              </>
            ) : (
              <>
                <FileDown className="h-5 w-5" />
                Usar Modelo Existente
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === "save"
              ? "Salve este formulário como modelo para usar em outros leads."
              : "Escolha um modelo para aplicar ao formulário atual."}
          </DialogDescription>
        </DialogHeader>

        {mode === "save" ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome do modelo</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ex: Formulário de Captação B2B"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Descrição (opcional)</Label>
              <Textarea
                id="template-description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Uma breve descrição do modelo..."
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTemplate} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar Modelo"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando modelos...
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum modelo salvo ainda.</p>
                <p className="text-sm">Crie um formulário e salve-o como modelo.</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="group p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleApplyTemplate(template)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{template.name}</h4>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{template.fields.length} campos</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(template.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                          onClick={(e) => handleDeleteTemplate(template.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
