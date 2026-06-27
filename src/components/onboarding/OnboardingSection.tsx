import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Plus, Pencil, Link as LinkIcon, Copy, Check, ExternalLink, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface OnboardingForm {
  id: string;
  name: string;
  slug: string;
  is_sequential: boolean;
  is_active: boolean;
  is_published: boolean;
  published_at: string | null;
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

interface OnboardingResponse {
  id: string;
  field_id: string;
  response_value: string | null;
  response_options: any;
  answered_at: string;
}

export interface OnboardingBuilderData {
  form: OnboardingForm;
  fields: OnboardingField[];
}

interface OnboardingSectionProps {
  leadId: string;
  leadName: string;
  inline?: boolean;
  onOpenBuilder?: (data: OnboardingBuilderData) => void;
}

export function OnboardingSection({ leadId, leadName, inline = false, onOpenBuilder }: OnboardingSectionProps) {
  const [form, setForm] = useState<OnboardingForm | null>(null);
  const [fields, setFields] = useState<OnboardingField[]>([]);
  const [responses, setResponses] = useState<OnboardingResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchOnboardingData = async () => {
    setIsLoading(true);
    
    // Fetch form
    const { data: formData } = await supabase
      .from("lead_onboarding_forms")
      .select("*")
      .eq("lead_id", leadId)
      .maybeSingle();
    
    if (formData) {
      setForm(formData);
      
      // Fetch fields
      const { data: fieldsData } = await supabase
        .from("lead_onboarding_fields")
        .select("*")
        .eq("form_id", formData.id)
        .order("ordem", { ascending: true });
      
      setFields(fieldsData || []);
      
      // Fetch responses
      const { data: responsesData } = await supabase
        .from("lead_onboarding_responses")
        .select("*")
        .eq("form_id", formData.id);
      
      setResponses(responsesData || []);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOnboardingData();
  }, [leadId]);

  const handleCreateForm = async () => {
    // Generate slug from lead name
    const slug = leadName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    
    const { data, error } = await supabase
      .from("lead_onboarding_forms")
      .insert({
        lead_id: leadId,
        name: "Onboarding",
        slug: `${slug}-${Date.now()}`,
        is_sequential: false,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      toast.error("Erro ao criar formulário");
      console.error(error);
      return;
    }
    
    setForm(data);
    // Open builder with the new form
    if (onOpenBuilder) {
      onOpenBuilder({ form: data, fields: [] });
    }
  };

  const handleOpenBuilder = () => {
    if (form && onOpenBuilder) {
      onOpenBuilder({ form, fields });
    }
  };

  const getFormLink = () => {
    if (!form) return "";
    return `https://io.scalebeauty.com.br/form/${form.slug}`;
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(getFormLink());
    setCopiedLink(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getResponseForField = (fieldId: string) => {
    return responses.find((r) => r.field_id === fieldId);
  };

  const formatResponseValue = (response: OnboardingResponse) => {
    if (response.response_value) return response.response_value;
    if (response.response_options && Array.isArray(response.response_options)) {
      return response.response_options.join(", ");
    }
    return "-";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Onboarding
          </h3>
        </div>
        <div className="h-12 flex items-center justify-center">
          <div className="animate-pulse text-sm text-muted-foreground">Carregando...</div>
        </div>
      </div>
    );
  }

  const content = (
    <div className="space-y-4">
      {/* Header with title and menu */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Lead Form
        </h3>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!form ? (
              <DropdownMenuItem onClick={handleCreateForm} className="cursor-pointer">
                <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Criar Formulário</span>
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={handleOpenBuilder} className="cursor-pointer">
                  <Pencil className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Editar Formulário</span>
                </DropdownMenuItem>
                {form.is_published && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={copyLink} className="cursor-pointer">
                      <Copy className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Copiar Link</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <a href={getFormLink()} target="_blank" rel="noopener noreferrer" className="flex items-center">
                        <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">Abrir Formulário</span>
                      </a>
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      {!form ? (
        // Empty state
        <div className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
          <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-neutral-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm font-medium text-muted-foreground italic">Nenhum formulário criado</p>
          </div>
        </div>
      ) : (
        // Form exists - show status and responses
        <>
          {/* Status row */}
          <div className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
            <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-neutral-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Status do Formulário</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{form.name}</p>
                {form.is_published ? (
                  <Badge className="bg-green-500 text-[10px] px-1.5 py-0 h-4">Publicado</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Rascunho</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Link row if published */}
          {form.is_published && (
            <div className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
              <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center">
                <LinkIcon className="h-5 w-5 text-neutral-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Link do Formulário</p>
                <p className="text-sm font-medium truncate">{getFormLink()}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={copyLink}>
                {copiedLink ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {/* Responses - only show fields that have responses */}
          {fields.length > 0 && fields.map((field) => {
            const response = getResponseForField(field.id);
            
            return (
              <div key={field.id} className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-neutral-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{field.title}</p>
                  {response ? (
                    <p className="text-sm font-medium">{formatResponseValue(response)}</p>
                  ) : (
                    <p className="text-sm font-medium text-muted-foreground italic">Aguardando resposta</p>
                  )}
                </div>
                {response ? (
                  <Badge className="bg-green-500 text-[10px] px-1.5 py-0 h-4 flex-shrink-0">Respondido</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">Pendente</Badge>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  // If inline, just return the content without Card wrapper
  if (inline) {
    return content;
  }

  // Otherwise, wrap in Card (for standalone use)
  return (
    <div className="border border-[#00000010] rounded-lg p-6">
      {content}
    </div>
  );
}
