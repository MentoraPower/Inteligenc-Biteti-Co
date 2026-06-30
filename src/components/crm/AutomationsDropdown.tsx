import { useState, useEffect, useRef, useMemo } from "react";
import { Play, Plus, Trash2, ArrowRight, Webhook, FolderSync, Copy, Check, Send, X, Settings, Mail, Loader2, Workflow, ClipboardCheck, UserPlus, UserMinus, ChevronDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pipeline } from "@/types/crm";
import { cn } from "@/lib/utils";
import { EmailFlowBuilder } from "./EmailFlowBuilder";
import { IntegrationsTab } from "./IntegrationsTab";

interface ExistingTag {
  name: string;
  color: string;
}

interface Origin {
  id: string;
  nome: string;
}

interface SubOrigin {
  id: string;
  origin_id: string;
  nome: string;
}

interface Automation {
  id: string;
  pipeline_id: string;
  target_type: string;
  target_sub_origin_id: string | null;
  target_origin_id: string | null;
  target_pipeline_id: string | null;
  is_active: boolean;
  sub_origin_id: string | null;
  trigger_type: string;
}

interface CrmWebhook {
  id: string;
  name: string;
  type: "receive" | "send";
  url: string | null;
  scope: "all" | "origin" | "sub_origin";
  origin_id: string | null;
  sub_origin_id: string | null;
  trigger: string | null;
  trigger_pipeline_id: string | null;
  is_active: boolean;
  auto_tag_name: string | null;
  auto_tag_color: string | null;
}

interface EmailAutomation {
  id: string;
  name: string;
  trigger_pipeline_id: string;
  sub_origin_id: string | null;
  subject: string;
  body_html: string;
  is_active: boolean;
  created_at: string;
  flow_steps: any[] | null;
}

interface EmailEditingContext {
  emailName: string;
  emailTriggerPipeline: string;
  editingEmailId: string | null;
  isCreating: boolean;
  emailSubject: string;
  emailBodyHtml: string;
}

interface AutomationsDropdownProps {
  pipelines: Pipeline[];
  subOriginId: string | null;
  onShowEmailBuilder?: (show: boolean, props?: EmailBuilderProps) => void;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  emailEditingContext?: EmailEditingContext | null;
  onEmailContextChange?: (context: EmailEditingContext | null) => void;
  embedded?: boolean;
  embeddedTab?: "automations" | "webhooks";
}

interface EmailBuilderProps {
  automationName: string;
  triggerPipelineName: string;
  onSave: (steps: any[]) => Promise<void>;
  onCancel: () => void;
  initialSteps?: any[];
  editingContext?: EmailEditingContext;
  pipelines?: Pipeline[];
  subOriginId?: string | null;
  automationId?: string;
  pendingEmailsCount?: number;
}

type ActiveTab = "automations" | "webhooks" | "integrations";

export function AutomationsDropdown({ 
  pipelines, 
  subOriginId, 
  onShowEmailBuilder, 
  externalOpen, 
  onOpenChange,
  emailEditingContext,
  onEmailContextChange,
  embedded = false,
  embeddedTab
}: AutomationsDropdownProps) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = embedded ? true : (externalOpen !== undefined ? externalOpen : internalOpen);
  const setOpen = onOpenChange || setInternalOpen;
  const [activeTab, setActiveTab] = useState<ActiveTab>(embeddedTab || "automations");
  
  // Automation creation/edit states
  const [isCreatingAutomation, setIsCreatingAutomation] = useState(false);
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string>("");
  const [selectedTriggerType, setSelectedTriggerType] = useState<string>("lead_moved");
  const [selectedTriggerPipeline, setSelectedTriggerPipeline] = useState<string>("");
  const [selectedActionOrigin, setSelectedActionOrigin] = useState<string>("");
  const [selectedActionSubOrigin, setSelectedActionSubOrigin] = useState<string>("");
  const [selectedActionPipeline, setSelectedActionPipeline] = useState<string>("");
  
  // Webhook states
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [webhookName, setWebhookName] = useState("");
  const [webhookType, setWebhookType] = useState<"receive" | "send" | "update">("receive");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookScope, setWebhookScope] = useState<"all" | "origin" | "sub_origin">("all");
  const [webhookOriginId, setWebhookOriginId] = useState<string>("");
  const [webhookSubOriginId, setWebhookSubOriginId] = useState<string>("");
  const [webhookTrigger, setWebhookTrigger] = useState<string>("");
  const [webhookTriggerPipelineId, setWebhookTriggerPipelineId] = useState<string>("");
  const [webhookAutoTagName, setWebhookAutoTagName] = useState<string>("");
  const [webhookAutoTagColor, setWebhookAutoTagColor] = useState<string>("#6366f1");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  
  // Email automation states
  const [isCreatingEmail, setIsCreatingEmail] = useState(false);
  const [showEmailFlowBuilder, setShowEmailFlowBuilder] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [emailName, setEmailName] = useState("");
  const [emailTriggerPipeline, setEmailTriggerPipeline] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBodyHtml, setEmailBodyHtml] = useState("");
  const [emailFlowSteps, setEmailFlowSteps] = useState<any[] | null>(null);

  // Restore email editing context when dropdown opens with context
  useEffect(() => {
    if (open && emailEditingContext) {
      setEmailName(emailEditingContext.emailName);
      setEmailTriggerPipeline(emailEditingContext.emailTriggerPipeline);
      setEditingEmailId(emailEditingContext.editingEmailId);
      setIsCreatingEmail(emailEditingContext.isCreating);
      setEmailSubject(emailEditingContext.emailSubject || "");
      setEmailBodyHtml(emailEditingContext.emailBodyHtml || "");
      setActiveTab("automations");
    }
  }, [open, emailEditingContext]);

  // Real-time subscription for email automations
  useEffect(() => {
    const channel = supabase
      .channel('email-automations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_automations'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["email-automations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Close tag dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagInputRef.current && !tagInputRef.current.closest('.relative')?.contains(event.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    
    if (tagDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [tagDropdownOpen]);
  
  const [copied, setCopied] = useState(false);
  const [triggerDropdownOpen, setTriggerDropdownOpen] = useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);

  // Fetch origins - only when dropdown is open
  const { data: origins = [] } = useQuery({
    queryKey: ["crm-origins"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_origins").select("*").order("ordem");
      return data as Origin[] || [];
    },
    enabled: open,
  });

  // Fetch sub-origins - only when dropdown is open
  const { data: subOrigins = [] } = useQuery({
    queryKey: ["crm-sub-origins"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_sub_origins").select("*").order("ordem");
      return data as SubOrigin[] || [];
    },
    enabled: open,
  });

  // Fetch all pipelines for target selection - only when dropdown is open
  const { data: allPipelines = [] } = useQuery({
    queryKey: ["all-pipelines"],
    queryFn: async () => {
      const { data } = await supabase.from("pipelines").select("*").order("ordem");
      return data as Pipeline[] || [];
    },
    enabled: open,
  });

  // Fetch automations - only when dropdown is open
  const { data: automations = [], refetch: refetchAutomations } = useQuery({
    queryKey: ["pipeline-automations", subOriginId],
    queryFn: async () => {
      let query = supabase.from("pipeline_automations").select("*");
      if (subOriginId) {
        query = query.eq("sub_origin_id", subOriginId);
      }
      const { data } = await query;
      return data as Automation[] || [];
    },
    enabled: open,
  });

  // Fetch webhooks - only when dropdown is open, filtered by sub_origin
  const { data: webhooks = [], refetch: refetchWebhooks } = useQuery({
    queryKey: ["crm-webhooks", subOriginId],
    queryFn: async () => {
      let query = supabase
        .from("crm_webhooks")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (subOriginId) {
        query = query.eq("sub_origin_id", subOriginId);
      }
      
      const { data } = await query;
      return (data || []) as CrmWebhook[];
    },
    enabled: open,
  });

  // Fetch email automations - only when dropdown is open
  const { data: emailAutomations = [], refetch: refetchEmailAutomations } = useQuery({
    queryKey: ["email-automations", subOriginId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("email_automations").select("*").order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching email automations:", error);
        return [];
      }
      let filtered = data || [];
      if (subOriginId) {
        filtered = filtered.filter((e: any) => e.sub_origin_id === subOriginId);
      }
      return filtered as EmailAutomation[];
    },
    enabled: open,
  });

  // Fetch pending scheduled emails count per automation
  const { data: pendingEmailsCounts = {} } = useQuery({
    queryKey: ["scheduled-emails-counts", subOriginId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("scheduled_emails")
        .select("automation_id")
        .eq("status", "pending");
      
      if (error) {
        console.error("Error fetching scheduled emails counts:", error);
        return {};
      }
      
      // Count by automation_id
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        counts[row.automation_id] = (counts[row.automation_id] || 0) + 1;
      });
      return counts;
    },
    enabled: open,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch existing unique tags for autocomplete - with pagination to get ALL tags
  const { data: existingTags = [] } = useQuery({
    queryKey: ["unique-lead-tags"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allTags: { name: string; color: string }[] = [];
      let page = 0;
      let hasMore = true;
      
      // Fetch all pages
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        const { data, error } = await supabase
          .from("lead_tags")
          .select("name, color")
          .range(from, to)
          .order("created_at", { ascending: true });
        
        if (error) {
          console.error("Error fetching tags page:", error);
          break;
        }
        
        if (data && data.length > 0) {
          allTags = [...allTags, ...data];
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Also include auto-tags defined on webhooks, so a tag that was saved but
      // not yet applied to any lead still shows up as a suggestion next time.
      const { data: webhookTags } = await supabase
        .from("crm_webhooks")
        .select("auto_tag_name, auto_tag_color")
        .not("auto_tag_name", "is", null);
      if (webhookTags && webhookTags.length > 0) {
        allTags = [
          ...allTags,
          ...webhookTags
            .filter((t: any) => t.auto_tag_name && String(t.auto_tag_name).trim())
            .map((t: any) => ({ name: t.auto_tag_name, color: t.auto_tag_color || "#6366f1" })),
        ];
      }

      // Get unique tags by name (case-insensitive, use first occurrence's color)
      const uniqueMap = new Map<string, string>();
      allTags.forEach((tag: any) => {
        const key = (tag.name || "").trim().toLowerCase();
        if (key && !uniqueMap.has(key)) {
          uniqueMap.set(key, tag.color);
        }
      });
      
      // Convert to array and sort alphabetically
      const result = Array.from(uniqueMap.entries())
        .map(([name, color]) => {
          // Find original name with proper casing
          const original = allTags.find(t => (t.name || "").trim().toLowerCase() === name);
          return { name: original?.name || name, color };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      
      return result as ExistingTag[];
    },
    enabled: open,
  });

  // Normalize string for accent-insensitive search
  const normalizeString = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  };

  // Filtered tags based on search input (accent-insensitive)
  const filteredExistingTags = useMemo(() => {
    if (!webhookAutoTagName.trim()) return existingTags;
    const search = normalizeString(webhookAutoTagName);
    return existingTags.filter(tag => normalizeString(tag.name).includes(search));
  }, [webhookAutoTagName, existingTags]);

  // Check if the current input matches an existing tag exactly
  const isNewTag = useMemo(() => {
    if (!webhookAutoTagName.trim()) return false;
    return !existingTags.some(tag => tag.name.toLowerCase() === webhookAutoTagName.toLowerCase().trim());
  }, [webhookAutoTagName, existingTags]);

  const activeEmailAutomationsCount = emailAutomations.filter(e => e.is_active).length;

  const activeAutomationsCount = automations.filter(a => a.is_active).length;
  const activeWebhooksCount = webhooks.filter(w => w.is_active).length;

  const getPipelineName = (pipelineId: string | null, pipelineList: Pipeline[] = pipelines) => {
    if (!pipelineId) return "";
    return pipelineList.find(p => p.id === pipelineId)?.nome || "";
  };

  const getOriginName = (originId: string | null) => {
    if (!originId) return "";
    return origins.find(o => o.id === originId)?.nome || "";
  };

  const getSubOriginName = (subOriginId: string | null) => {
    if (!subOriginId) return "";
    return subOrigins.find(s => s.id === subOriginId)?.nome || "";
  };

  const createAutomation = async () => {
    // For lead_moved, require pipeline; for onboarding_completed, pipeline is optional
    if (selectedTriggerType === "lead_moved" && !selectedTriggerPipeline) {
      toast.error("Selecione a pipeline de gatilho");
      return;
    }

    try {
      const { error } = await supabase.from("pipeline_automations").insert({
        pipeline_id: selectedTriggerPipeline || null,
        target_type: 'sub_origin',
        target_origin_id: selectedActionOrigin || null,
        target_sub_origin_id: selectedActionSubOrigin || null,
        target_pipeline_id: selectedActionPipeline || null,
        is_active: true,
        sub_origin_id: subOriginId,
        trigger_type: selectedTriggerType,
      });

      if (error) throw error;

      refetchAutomations();
      queryClient.invalidateQueries({ queryKey: ["pipeline-automations", subOriginId] });
      toast.success("Automação criada!");
      resetAutomationForm();
    } catch (error) {
      console.error("Erro ao criar automação:", error);
      toast.error("Erro ao criar automação");
    }
  };

  const saveAutomationEdit = async () => {
    if (!editingAutomationId) return;
    
    try {
      const { error } = await supabase
        .from("pipeline_automations")
        .update({
          pipeline_id: selectedTriggerPipeline || null,
          target_origin_id: selectedActionOrigin || null,
          target_sub_origin_id: selectedActionSubOrigin || null,
          target_pipeline_id: selectedActionPipeline || null,
          trigger_type: selectedTriggerType,
        })
        .eq("id", editingAutomationId);

      if (error) throw error;

      refetchAutomations();
      queryClient.invalidateQueries({ queryKey: ["pipeline-automations", subOriginId] });
      toast.success("Automação atualizada!");
      resetAutomationForm();
    } catch (error) {
      console.error("Erro ao atualizar automação:", error);
      toast.error("Erro ao atualizar automação");
    }
  };

  const startEditingAutomation = (automation: Automation) => {
    setEditingAutomationId(automation.id);
    setIsCreatingAutomation(true);
    setSelectedTriggerType(automation.trigger_type || "lead_moved");
    setSelectedTrigger("lead_moved");
    setSelectedTriggerPipeline(automation.pipeline_id || "");
    setSelectedActionOrigin(automation.target_origin_id || "");
    setSelectedActionSubOrigin(automation.target_sub_origin_id || "");
    setSelectedActionPipeline(automation.target_pipeline_id || "");
  };

  const resetAutomationForm = () => {
    setIsCreatingAutomation(false);
    setEditingAutomationId(null);
    setSelectedTrigger("");
    setSelectedTriggerType("lead_moved");
    setSelectedTriggerPipeline("");
    setSelectedActionOrigin("");
    setSelectedActionSubOrigin("");
    setSelectedActionPipeline("");
    setTriggerDropdownOpen(false);
    setActionDropdownOpen(false);
  };

  const updateAutomation = async (automationId: string, updates: Partial<Automation>) => {
    try {
      const { error } = await supabase
        .from("pipeline_automations")
        .update(updates)
        .eq("id", automationId);

      if (error) throw error;

      refetchAutomations();
      queryClient.invalidateQueries({ queryKey: ["pipeline-automations", subOriginId] });
    } catch (error) {
      console.error("Erro ao atualizar automação:", error);
      toast.error("Erro ao atualizar automação");
    }
  };

  const deleteAutomation = async (automationId: string) => {
    try {
      const { error } = await supabase
        .from("pipeline_automations")
        .delete()
        .eq("id", automationId);

      if (error) throw error;

      refetchAutomations();
      queryClient.invalidateQueries({ queryKey: ["pipeline-automations", subOriginId] });
      toast.success("Automação removida!");
    } catch (error) {
      console.error("Erro ao remover automação:", error);
      toast.error("Erro ao remover automação");
    }
  };

  const getTargetPipelines = (targetSubOriginId: string | null) => {
    if (!targetSubOriginId) return [];
    return allPipelines.filter(p => p.sub_origin_id === targetSubOriginId);
  };

  const getSendTriggerPipelines = () => {
    if (webhookScope === "sub_origin" && webhookSubOriginId) {
      return allPipelines.filter(p => p.sub_origin_id === webhookSubOriginId);
    } else if (webhookScope === "origin" && webhookOriginId) {
      const subOriginsInOrigin = subOrigins.filter(s => s.origin_id === webhookOriginId);
      return allPipelines.filter(p => subOriginsInOrigin.some(s => s.id === p.sub_origin_id));
    }
    return allPipelines;
  };

  const getGeneratedWebhookUrl = () => {
    // Use the platform's current domain (Vercel deployment / custom domain).
    // The /api/webhook path is proxied to the Supabase receive-webhook function
    // via the rewrite in vercel.json.
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const baseUrl = `${origin}/api/webhook`;
    const params = new URLSearchParams();
    params.append("sub_origin_id", subOriginId);
    if (webhookType === "receive" && webhookTriggerPipelineId) {
      params.append("pipeline_id", webhookTriggerPipelineId);
    }
    if (webhookType === "update") {
      params.append("mode", "update");
    }
    return `${baseUrl}?${params.toString()}`;
  };

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const createWebhook = async () => {
    if (!webhookName.trim()) {
      toast.error("Digite um nome para o webhook");
      return;
    }
    if (webhookType === "send" && !webhookUrl.trim()) {
      toast.error("Digite a URL de destino");
      return;
    }
    if (webhookType === "send" && !webhookTrigger) {
      toast.error("Selecione um gatilho");
      return;
    }
    if (webhookType === "send" && webhookTrigger === "lead_moved" && !webhookTriggerPipelineId) {
      toast.error("Selecione a pipeline de destino");
      return;
    }
    if (webhookType === "receive" && !webhookTriggerPipelineId) {
      toast.error("Selecione em qual pipeline o lead vai cair");
      return;
    }
    // "update" type doesn't need pipeline validation - works across all pipelines

    try {
      const webhookData = {
        name: webhookName,
        type: webhookType === "update" ? "receive" : webhookType, // "update" is stored as "receive" type
        url: webhookType === "send" ? webhookUrl : getGeneratedWebhookUrl(),
        scope: "sub_origin" as const,
        origin_id: null,
        sub_origin_id: subOriginId,
        trigger: webhookType === "send" ? webhookTrigger : null,
        trigger_pipeline_id: webhookType === "receive" ? (webhookTriggerPipelineId || null) : null, // update type has no pipeline
        is_active: true,
        auto_tag_name: webhookAutoTagName.trim() || null,
        auto_tag_color: webhookAutoTagColor || "#6366f1",
      };

      if (editingWebhookId) {
        const { error } = await supabase
          .from("crm_webhooks")
          .update(webhookData)
          .eq("id", editingWebhookId);
        if (error) throw error;
        toast.success("Webhook atualizado!");
      } else {
        const { error } = await supabase.from("crm_webhooks").insert(webhookData);
        if (error) throw error;
        toast.success("Webhook criado!");
      }

      refetchWebhooks();
      queryClient.invalidateQueries({ queryKey: ["crm-webhooks", subOriginId] });
      // Refresh the auto-tag suggestions so a newly defined tag appears next time.
      queryClient.invalidateQueries({ queryKey: ["unique-lead-tags"] });
      resetWebhookForm();
    } catch (error) {
      console.error("Erro ao salvar webhook:", error);
      toast.error("Erro ao salvar webhook");
    }
  };

  const toggleWebhook = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("crm_webhooks")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      refetchWebhooks();
      queryClient.invalidateQueries({ queryKey: ["crm-webhooks", subOriginId] });
    } catch (error) {
      console.error("Erro ao atualizar webhook:", error);
      toast.error("Erro ao atualizar webhook");
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      const { error } = await supabase.from("crm_webhooks").delete().eq("id", id);
      if (error) throw error;
      refetchWebhooks();
      queryClient.invalidateQueries({ queryKey: ["crm-webhooks", subOriginId] });
      toast.success("Webhook removido!");
    } catch (error) {
      console.error("Erro ao remover webhook:", error);
      toast.error("Erro ao remover webhook");
    }
  };

  const resetWebhookForm = () => {
    setIsCreatingWebhook(false);
    setEditingWebhookId(null);
    setWebhookName("");
    setWebhookType("receive");
    setWebhookUrl("");
    setWebhookScope("all");
    setWebhookOriginId("");
    setWebhookSubOriginId("");
    setWebhookTrigger("");
    setWebhookTriggerPipelineId("");
    setWebhookAutoTagName("");
    setWebhookAutoTagColor("#6366f1");
    setTagDropdownOpen(false);
  };

  const startEditingWebhook = (webhook: CrmWebhook & { auto_tag_name?: string | null; auto_tag_color?: string | null }) => {
    setEditingWebhookId(webhook.id);
    setIsCreatingWebhook(true);
    setWebhookName(webhook.name);
    setWebhookType(webhook.type);
    setWebhookUrl(webhook.url || "");
    setWebhookScope(webhook.scope);
    setWebhookOriginId(webhook.origin_id || "");
    setWebhookSubOriginId(webhook.sub_origin_id || "");
    setWebhookTrigger(webhook.trigger || "");
    setWebhookTriggerPipelineId(webhook.trigger_pipeline_id || "");
    setWebhookAutoTagName(webhook.auto_tag_name || "");
    setWebhookAutoTagColor(webhook.auto_tag_color || "#6366f1");
  };


  // Email automation functions
  const createEmailAutomation = async () => {
    if (!emailName.trim()) {
      toast.error("Digite um nome para a automação");
      return;
    }
    if (!emailTriggerPipeline) {
      toast.error("Selecione a pipeline de gatilho");
      return;
    }
    if (!emailSubject.trim()) {
      toast.error("Digite o assunto do e-mail");
      return;
    }
    if (!emailBodyHtml.trim()) {
      toast.error("Digite o conteúdo HTML do e-mail");
      return;
    }

    try {
      const { error } = await (supabase as any).from("email_automations").insert({
        name: emailName,
        trigger_pipeline_id: emailTriggerPipeline,
        sub_origin_id: subOriginId,
        subject: emailSubject,
        body_html: emailBodyHtml,
        is_active: true,
      });

      if (error) throw error;

      refetchEmailAutomations();
      resetEmailForm();
      toast.success("Automação de e-mail criada!");
    } catch (error) {
      console.error("Erro ao criar automação de e-mail:", error);
      toast.error("Erro ao criar automação de e-mail");
    }
  };

  const updateEmailAutomation = async () => {
    if (!editingEmailId) return;
    
    if (!emailTriggerPipeline) {
      toast.error("Selecione a pipeline de gatilho");
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("email_automations")
        .update({
          name: emailName,
          trigger_pipeline_id: emailTriggerPipeline,
          subject: emailSubject,
          body_html: emailBodyHtml,
        })
        .eq("id", editingEmailId);

      if (error) throw error;

      refetchEmailAutomations();
      resetEmailForm();
      toast.success("Automação atualizada!");
    } catch (error) {
      console.error("Erro ao atualizar automação:", error);
      toast.error("Erro ao atualizar automação");
    }
  };

  const toggleEmailAutomation = async (id: string, isActive: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("email_automations")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      refetchEmailAutomations();
    } catch (error) {
      console.error("Erro ao atualizar automação:", error);
      toast.error("Erro ao atualizar automação");
    }
  };

  const deleteEmailAutomation = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("email_automations").delete().eq("id", id);
      if (error) throw error;
      refetchEmailAutomations();
      toast.success("Automação removida!");
    } catch (error) {
      console.error("Erro ao remover automação:", error);
      toast.error("Erro ao remover automação");
    }
  };

  const startEditingEmail = (email: EmailAutomation) => {
    setEditingEmailId(email.id);
    setIsCreatingEmail(true);
    setEmailName(email.name);
    setEmailTriggerPipeline(email.trigger_pipeline_id);
    setEmailSubject(email.subject);
    setEmailBodyHtml(email.body_html);
    setEmailFlowSteps(email.flow_steps || null);
  };

  const resetEmailForm = () => {
    setIsCreatingEmail(false);
    setEditingEmailId(null);
    setEmailName("");
    setEmailTriggerPipeline("");
    setEmailSubject("");
    setEmailBodyHtml("");
    setEmailFlowSteps(null);
  };

  const getTriggerLabel = (trigger: string | null, pipelineId?: string | null) => {
    if (!trigger) return "";
    const triggers: Record<string, string> = {
      "lead_created": "Lead criado",
      "lead_moved": "Lead movido para pipeline",
      "lead_updated": "Lead atualizado",
      "lead_deleted": "Lead excluído",
    };
    let label = triggers[trigger] || trigger;
    if (trigger === "lead_moved" && pipelineId) {
      const pipeline = allPipelines.find(p => p.id === pipelineId);
      if (pipeline) {
        label += `: ${pipeline.nome}`;
      }
    }
    return label;
  };

  const openingEmailBuilderRef = useRef(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen && !openingEmailBuilderRef.current) {
      resetAutomationForm();
      resetWebhookForm();
      resetEmailForm();
      setShowEmailFlowBuilder(false);
    }
    if (!isOpen) {
      openingEmailBuilderRef.current = false;
    }
  };

  const handleOpenEmailFlowBuilder = (emailData?: EmailAutomation | null) => {
    const name = emailData?.name || emailName || "Nova automação";
    const flowSteps = emailData?.flow_steps || emailFlowSteps;
    const subject = emailData?.subject || emailSubject;
    const bodyHtml = emailData?.body_html || emailBodyHtml;
    const editId = emailData?.id || editingEmailId;
    const triggerPipelineId = emailData?.trigger_pipeline_id || emailTriggerPipeline;
    
    // Use saved flow_steps if available, otherwise create default structure when editing
    const getInitialSteps = () => {
      if (flowSteps && flowSteps.length > 0) {
        return flowSteps;
      }
      if (editId) {
        return [
          { id: "trigger-1", type: "trigger", position: { x: 100, y: 200 }, data: { label: "Adicionar gatilhos", triggerType: "lead_entered_pipeline", triggerPipelineId } },
          { id: "email-1", type: "email", position: { x: 380, y: 200 }, data: { label: "Enviar e-mail", subject, bodyHtml } },
          { id: "end-1", type: "end", position: { x: 660, y: 200 }, data: { label: "Fluxo finalizado" } },
        ];
      }
      return undefined;
    };
    
    // Create save handler with captured context
    const handleSave = async (steps: any[]) => {
      // Extract email steps to build HTML
      const emailSteps = steps.filter(s => s.type === "email");
      if (emailSteps.length === 0) {
        toast.error("Adicione pelo menos um passo de e-mail");
        return;
      }

      // Extract trigger configuration from TriggerNode
      const triggerStep = steps.find(s => s.type === "trigger");
      
      // Support both new triggers array format and legacy triggerPipelineId
      const triggers = triggerStep?.data?.triggers as Array<{ id: string; type: string; pipelineId?: string }> | undefined;
      
      // Check if we have any trigger configured
      const hasTriggers = triggers && triggers.length > 0;
      const hasLegacyTrigger = triggerStep?.data?.triggerPipelineId || triggerPipelineId;
      
      if (!hasTriggers && !hasLegacyTrigger) {
        toast.error("Selecione pelo menos um gatilho no nó de trigger");
        return;
      }
      
      // Get pipeline ID from first pipeline trigger (if any)
      const pipelineTrigger = triggers?.find(t => t.type === "lead_entered_pipeline");
      const extractedTriggerPipelineId = pipelineTrigger?.pipelineId || triggerStep?.data?.triggerPipelineId || triggerPipelineId || null;

      // For now, use the first email step's data
      const firstEmail = emailSteps[0];
      const finalSubject = firstEmail.data.subject || subject;
      const finalBodyHtml = firstEmail.data.bodyHtml || bodyHtml;

      if (!finalSubject.trim()) {
        toast.error("Digite o assunto do e-mail");
        return;
      }
      if (!finalBodyHtml.trim()) {
        toast.error("Digite o conteúdo HTML do e-mail");
        return;
      }

      try {
        const triggerPipelineIdForDb = extractedTriggerPipelineId && String(extractedTriggerPipelineId).trim()
          ? extractedTriggerPipelineId
          : null;

        // Debug (avoid logging full HTML)
        console.log("[EmailAutomationSaveInline]", {
          editId,
          subOriginId,
          triggersCount: Array.isArray(triggers) ? triggers.length : 0,
          triggerPipelineIdForDb,
          subjectLen: finalSubject?.length || 0,
          bodyHtmlLen: finalBodyHtml?.length || 0,
        });

        if (editId) {
          const { error } = await (supabase as any)
            .from("email_automations")
            .update({
              name,
              trigger_pipeline_id: triggerPipelineIdForDb,
              subject: finalSubject,
              body_html: finalBodyHtml,
              flow_steps: steps,
            })
            .eq("id", editId);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any).from("email_automations").insert({
            name,
            trigger_pipeline_id: triggerPipelineIdForDb,
            sub_origin_id: subOriginId,
            subject: finalSubject,
            body_html: finalBodyHtml,
            is_active: true,
            flow_steps: steps,
          });
          if (error) throw error;
        }

        refetchEmailAutomations();
        resetEmailForm();
        setShowEmailFlowBuilder(false);
        toast.success(editId ? "Automação atualizada!" : "Automação de e-mail criada!");
      } catch (error: any) {
        console.error("Erro ao salvar automação de e-mail:", error);
        toast.error(error?.message ? `Erro ao salvar automação: ${error.message}` : "Erro ao salvar automação de e-mail");
      }
    };
    
    if (onShowEmailBuilder) {
      openingEmailBuilderRef.current = true;
      setOpen(false); // Close the dropdown
      
      // Get pending count for this automation
      const pendingCount = editId ? (pendingEmailsCounts[editId] || 0) : 0;
      
      onShowEmailBuilder(true, {
        automationName: name,
        triggerPipelineName: "",
        onSave: handleSave,
        onCancel: () => {
          onShowEmailBuilder(false);
        },
        initialSteps: getInitialSteps(),
        editingContext: {
          emailName: name,
          emailTriggerPipeline: triggerPipelineId || "",
          editingEmailId: editId || null,
          isCreating: true,
          emailSubject: subject,
          emailBodyHtml: bodyHtml,
        },
        pipelines: allPipelines,
        subOriginId,
        automationId: editId || undefined,
        pendingEmailsCount: pendingCount,
      });
    } else {
      setShowEmailFlowBuilder(true);
    }
  };

  const handleSaveEmailFlow = async (steps: any[]) => {
    // This is kept for the fallback local flow builder
    const emailSteps = steps.filter(s => s.type === "email");
    if (emailSteps.length === 0) {
      toast.error("Adicione pelo menos um passo de e-mail");
      return;
    }

    const triggerStep = steps.find(s => s.type === "trigger");
    
    // Support both new triggers array format and legacy triggerPipelineId
    const triggers = triggerStep?.data?.triggers as Array<{ id: string; type: string; pipelineId?: string }> | undefined;
    
    // Check if we have any trigger configured
    const hasTriggers = triggers && triggers.length > 0;
    const hasLegacyTrigger = triggerStep?.data?.triggerPipelineId || emailTriggerPipeline;
    
    if (!hasTriggers && !hasLegacyTrigger) {
      toast.error("Selecione pelo menos um gatilho no nó de trigger");
      return;
    }
    
    // Get pipeline ID from first pipeline trigger (if any)
    const pipelineTrigger = triggers?.find(t => t.type === "lead_entered_pipeline");
    const triggerPipelineId = pipelineTrigger?.pipelineId || triggerStep?.data?.triggerPipelineId || emailTriggerPipeline || null;

    const firstEmail = emailSteps[0];
    const subject = firstEmail.data.subject || emailSubject;
    const bodyHtml = firstEmail.data.bodyHtml || emailBodyHtml;

    if (!subject.trim()) {
      toast.error("Digite o assunto do e-mail");
      return;
    }
    if (!bodyHtml.trim()) {
      toast.error("Digite o conteúdo HTML do e-mail");
      return;
    }

    try {
      const triggerPipelineIdForDb = triggerPipelineId && String(triggerPipelineId).trim() ? triggerPipelineId : null;

      // Debug (avoid logging full HTML)
      console.log("[EmailAutomationSave]", {
        editingEmailId,
        subOriginId,
        triggersCount: Array.isArray(triggers) ? triggers.length : 0,
        triggerPipelineIdForDb,
        subjectLen: subject?.length || 0,
        bodyHtmlLen: bodyHtml?.length || 0,
      });

      if (editingEmailId) {
        const { error } = await (supabase as any)
          .from("email_automations")
          .update({
            name: emailName,
            trigger_pipeline_id: triggerPipelineIdForDb,
            subject,
            body_html: bodyHtml,
            flow_steps: steps,
          })
          .eq("id", editingEmailId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("email_automations").insert({
          name: emailName,
          trigger_pipeline_id: triggerPipelineIdForDb,
          sub_origin_id: subOriginId,
          subject,
          body_html: bodyHtml,
          is_active: true,
          flow_steps: steps,
        });
        if (error) throw error;
      }

      refetchEmailAutomations();
      resetEmailForm();
      setShowEmailFlowBuilder(false);
      toast.success(editingEmailId ? "Automação atualizada!" : "Automação de e-mail criada!");
    } catch (error: any) {
      console.error("Erro ao salvar automação de e-mail:", error);
      toast.error(error?.message ? `Erro ao salvar automação: ${error.message}` : "Erro ao salvar automação de e-mail");
    }
  };

  const receiveWebhooks = webhooks.filter(w => w.type === "receive");
  const sendWebhooks = webhooks.filter(w => w.type === "send");

  const triggerOptions = [
    { id: "lead_moved", label: "Lead movido para pipeline", icon: ArrowRight },
    { id: "lead_created", label: "Lead criado", icon: Plus },
    { id: "lead_updated", label: "Lead atualizado", icon: Settings },
  ];

  // If using local state for email flow builder (fallback when no callback provided)
  if (showEmailFlowBuilder && !onShowEmailBuilder) {
    const triggerPipelineName = pipelines.find(p => p.id === emailTriggerPipeline)?.nome || "";
    
    // Use saved flow_steps if available, otherwise create default structure when editing
    const getFallbackInitialSteps = () => {
      if (emailFlowSteps && emailFlowSteps.length > 0) {
        return emailFlowSteps;
      }
      if (editingEmailId) {
        return [
          { id: "trigger-1", type: "trigger", position: { x: 100, y: 200 }, data: { label: "Gatilho", triggerType: "lead_entered_pipeline", triggerPipelineId: emailTriggerPipeline } },
          { id: "email-1", type: "email", position: { x: 380, y: 200 }, data: { label: "Enviar e-mail", subject: emailSubject, bodyHtml: emailBodyHtml } },
          { id: "end-1", type: "end", position: { x: 660, y: 200 }, data: { label: "Fluxo finalizado" } },
        ];
      }
      return undefined;
    };
    
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <div className="relative inline-flex overflow-visible">
            <Button variant="outline" className="h-9 gap-2 bg-transparent hover:bg-muted/50 text-foreground border border-border">
              <Play className="w-4 h-4" />
              <span className="text-sm font-medium">Start</span>
            </Button>
            {(activeAutomationsCount + activeWebhooksCount + activeEmailAutomationsCount) > 0 && (
              <span className="absolute top-[2px] right-[2px] z-10 h-4 min-w-4 px-1 text-[10px] font-medium flex items-center justify-center bg-yellow-400 text-black rounded-full pointer-events-none">
                {activeAutomationsCount + activeWebhooksCount + activeEmailAutomationsCount}
              </span>
            )}
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-6xl h-[85vh] overflow-hidden p-0 bg-background border-border" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Editor de Fluxo de E-mail</DialogTitle>
          <EmailFlowBuilder
            automationName={emailName}
            triggerPipelineName={triggerPipelineName}
            onSave={handleSaveEmailFlow}
            onCancel={() => setShowEmailFlowBuilder(false)}
            initialSteps={getFallbackInitialSteps()}
            pipelines={allPipelines}
            subOriginId={subOriginId}
            automationId={editingEmailId || undefined}
            pendingEmailsCount={editingEmailId ? (pendingEmailsCounts[editingEmailId] || 0) : 0}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // When embedded, just render the content without Dialog wrapper
  if (embedded) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="overflow-y-auto h-full">
          {/* Automations Tab */}
          {activeTab === "automations" && (
            <div className="px-6 pb-6">
              {/* Active/Inactive filter */}
              <div className="flex items-center gap-2 mb-6">
                <button className="px-3 py-1.5 text-sm rounded-lg bg-foreground/10 text-foreground font-medium">
                  Ativo {activeAutomationsCount}
                </button>
                <button className="px-3 py-1.5 text-sm rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                  Inativo {automations.length - activeAutomationsCount}
                </button>
                <div className="flex-1" />
                <Button
                  onClick={() => {
                    setIsCreatingAutomation(true);
                    setSelectedTrigger("lead_moved");
                  }}
                  className="bg-foreground hover:bg-foreground/90 text-background"
                  disabled={isCreatingAutomation}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar automação
                </Button>
              </div>

              {/* Create automation flow */}
              {isCreatingAutomation && (
                <div className="mb-6 p-5 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-foreground">
                      {editingAutomationId ? "Editar automação" : "Nova automação"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={resetAutomationForm}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Two-column layout: Trigger -> Action */}
                  <div className="flex items-stretch gap-3">
                    {/* Trigger Column */}
                    <div className="flex-1">
                      <div className="rounded-lg bg-background border border-border h-full">
                        <div className="flex items-center gap-2 p-3 border-b border-border">
                          <span className="text-foreground text-sm font-medium">Quando</span>
                        </div>

                        <div className="p-3 space-y-2">
                          {/* Trigger type selector */}
                          <Select
                            value={selectedTriggerType}
                            onValueChange={(v) => {
                              setSelectedTriggerType(v);
                              setSelectedTriggerPipeline("");
                            }}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecione o gatilho..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lead_moved">
                                <div className="flex items-center gap-2">
                                  <ArrowRight className="h-4 w-4" />
                                  Lead movido para pipeline
                                </div>
                              </SelectItem>
                              <SelectItem value="grupo_entrada">
                                <div className="flex items-center gap-2">
                                  <UserPlus className="h-4 w-4" />
                                  Entrou no grupo
                                </div>
                              </SelectItem>
                              <SelectItem value="grupo_saida">
                                <div className="flex items-center gap-2">
                                  <UserMinus className="h-4 w-4" />
                                  Saiu do grupo
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Pipeline selector - only for lead_moved */}
                          {selectedTriggerType === "lead_moved" && (
                            <Select value={selectedTriggerPipeline} onValueChange={setSelectedTriggerPipeline}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Selecione a pipeline..." />
                              </SelectTrigger>
                              <SelectContent>
                                {pipelines.map((pipeline) => (
                                  <SelectItem key={pipeline.id} value={pipeline.id}>
                                    {pipeline.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Action Column */}
                    <div className="flex-1">
                      <div className="rounded-lg bg-background border border-border h-full">
                        <div className="flex items-center gap-2 p-3 border-b border-border">
                          <span className="text-foreground text-sm font-medium">Então</span>
                        </div>

                        <div className="p-3 space-y-2">
                          <Select
                            value={selectedActionOrigin}
                            onValueChange={(v) => {
                              setSelectedActionOrigin(v);
                              setSelectedActionSubOrigin("");
                              setSelectedActionPipeline("");
                            }}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Origem..." />
                            </SelectTrigger>
                            <SelectContent>
                              {origins.map((origin) => (
                                <SelectItem key={origin.id} value={origin.id}>
                                  {origin.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={selectedActionSubOrigin}
                            onValueChange={(v) => {
                              setSelectedActionSubOrigin(v);
                              setSelectedActionPipeline("");
                            }}
                            disabled={!selectedActionOrigin}
                          >
                            <SelectTrigger className="h-9 text-sm disabled:opacity-50">
                              <SelectValue placeholder="Sub-origem..." />
                            </SelectTrigger>
                            <SelectContent>
                              {subOrigins
                                .filter((s) => s.origin_id === selectedActionOrigin)
                                .map((subOrigin) => (
                                  <SelectItem key={subOrigin.id} value={subOrigin.id}>
                                    {subOrigin.nome}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={selectedActionPipeline}
                            onValueChange={setSelectedActionPipeline}
                            disabled={!selectedActionSubOrigin}
                          >
                            <SelectTrigger className="h-9 text-sm disabled:opacity-50">
                              <SelectValue placeholder="Pipeline..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getTargetPipelines(selectedActionSubOrigin).map((pipeline) => (
                                <SelectItem key={pipeline.id} value={pipeline.id}>
                                  {pipeline.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Quando</span>
                      <span className="px-1.5 py-0.5 bg-muted rounded text-foreground text-xs">
                        {selectedTriggerType === "onboarding_completed"
                          ? "Onboarding preenchido"
                          : selectedTriggerType === "grupo_entrada"
                            ? "Entrou no grupo"
                            : selectedTriggerType === "grupo_saida"
                              ? "Saiu do grupo"
                              : selectedTriggerPipeline
                                ? `Movido para ${getPipelineName(selectedTriggerPipeline)}`
                                : "..."}
                      </span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="px-1.5 py-0.5 bg-muted rounded text-foreground text-xs">
                        {selectedActionPipeline
                          ? `${getOriginName(selectedActionOrigin)} / ${getSubOriginName(selectedActionSubOrigin)} / ${getPipelineName(selectedActionPipeline, allPipelines)}`
                          : "..."}
                      </span>
                    </div>
                    <Button
                      onClick={editingAutomationId ? saveAutomationEdit : createAutomation}
                      className="h-10 px-6 rounded gap-2 text-sm font-semibold bg-foreground hover:bg-foreground/90 text-background flex-shrink-0"
                      disabled={selectedTriggerType === "lead_moved" && !selectedTriggerPipeline}
                    >
                      {editingAutomationId ? (
                        <>
                          <Check className="w-4 h-4" /> Salvar
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" /> Criar automação
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Automations list - simplified for embedded view */}
              {automations.length === 0 && !isCreatingAutomation ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Nenhuma automação criada</p>
                  <p className="text-sm mt-1">Crie sua primeira automação para automatizar movimentações de leads</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Column headers */}
                  <div className="flex items-center justify-between px-4 pb-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Gatilho / Ação
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="w-12 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Ativa
                      </span>
                      <span className="w-16 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Ações
                      </span>
                    </div>
                  </div>

                  {automations.map((automation) => (
                    <div key={automation.id} className="p-4 rounded bg-muted/30 border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", automation.is_active ? "bg-emerald-500" : "bg-gray-400")} />
                          <span className="text-sm font-medium">
                            Quando lead entrar em "{getPipelineName(automation.pipeline_id || "")}"
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Mover para "{getPipelineName(automation.target_pipeline_id || "")}"
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-12 flex justify-center">
                            <button
                              onClick={() => updateAutomation(automation.id, { is_active: !automation.is_active })}
                              className={cn(
                                "relative w-10 h-5 rounded-full transition-colors",
                                automation.is_active ? "bg-emerald-500" : "bg-muted"
                              )}
                            >
                              <span
                                className={cn(
                                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                                  automation.is_active ? "left-[22px]" : "left-0.5"
                                )}
                              />
                            </button>
                          </div>
                          <div className="w-16 flex items-center justify-center gap-1">
                            <button
                              onClick={() => startEditingAutomation(automation)}
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteAutomation(automation.id)}
                              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Webhooks Tab */}
          {activeTab === "webhooks" && (
            <div className="px-6 pb-6">
              <div className="flex items-center gap-2 mb-6">
                <button className="px-3 py-1.5 text-sm rounded-lg bg-foreground/10 text-foreground font-medium">
                  Receber
                </button>
                <button className="px-3 py-1.5 text-sm rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                  Enviar
                </button>
                <div className="flex-1" />
                <Button
                  onClick={() => setIsCreatingWebhook(true)}
                  className="bg-foreground hover:bg-foreground/90 text-background"
                  disabled={isCreatingWebhook}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar webhook
                </Button>
              </div>

              {/* Create webhook form */}
              {isCreatingWebhook && (
                <div className="mb-6 p-5 rounded-xl bg-muted/50 border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {editingWebhookId ? "Editar Webhook" : "Novo Webhook"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={resetWebhookForm}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Nome do webhook..."
                      value={webhookName}
                      onChange={(e) => setWebhookName(e.target.value)}
                      className="h-10"
                    />
                    <Select value={webhookType} onValueChange={(v: "receive" | "send" | "update") => setWebhookType(v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receive">Receber</SelectItem>
                        <SelectItem value="send">Enviar</SelectItem>
                        <SelectItem value="update">Atualizar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {webhookType === "send" && (
                    <>
                      <Input
                        placeholder="URL de destino..."
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="h-10"
                      />
                      <Select
                        value={webhookTrigger}
                        onValueChange={(v) => {
                          setWebhookTrigger(v);
                          setWebhookTriggerPipelineId("");
                        }}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Selecione o gatilho..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead_created">Lead criado</SelectItem>
                          <SelectItem value="lead_moved">Lead movido para pipeline</SelectItem>
                          <SelectItem value="lead_updated">Lead atualizado</SelectItem>
                          <SelectItem value="lead_deleted">Lead excluído</SelectItem>
                        </SelectContent>
                      </Select>

                      {webhookTrigger === "lead_moved" && (
                        <Select value={webhookTriggerPipelineId} onValueChange={setWebhookTriggerPipelineId}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Selecione a pipeline..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getSendTriggerPipelines().map((pipeline) => (
                              <SelectItem key={pipeline.id} value={pipeline.id}>
                                {pipeline.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </>
                  )}

                  {webhookType === "receive" && (
                    <Select 
                      value={webhookTriggerPipelineId} 
                      onValueChange={setWebhookTriggerPipelineId}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Em qual pipeline o lead vai cair?" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelines.map((pipeline) => (
                          <SelectItem key={pipeline.id} value={pipeline.id}>
                            {pipeline.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {webhookType === "update" && (
                    <p className="text-xs text-muted-foreground">
                      O webhook de atualização não move leads entre pipelines. Apenas atualiza os dados do lead existente em qualquer pipeline desta sub-origem.
                    </p>
                  )}

                  {(webhookType === "receive" || webhookType === "update") && (
                    <>
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                          URL gerada
                        </span>
                        <div className="flex gap-2">
                          <Input value={getGeneratedWebhookUrl()} readOnly className="flex-1 h-9 text-xs font-mono" />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3"
                            onClick={() => copyWebhookUrl(getGeneratedWebhookUrl())}
                          >
                            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Auto-tag section */}
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                          Tag automática (opcional)
                        </span>
                        <p className="text-xs text-muted-foreground mb-3">
                          Quando um lead for criado por este webhook, a tag será adicionada automaticamente
                        </p>
                        <div className="relative">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input 
                                ref={tagInputRef}
                                placeholder="Digite ou selecione uma tag..." 
                                value={webhookAutoTagName}
                                onChange={(e) => {
                                  setWebhookAutoTagName(e.target.value);
                                  setTagDropdownOpen(true);
                                }}
                                onFocus={() => setTagDropdownOpen(true)}
                                className="h-9 pr-8"
                              />
                              <button
                                type="button"
                                onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                <ChevronDown className={cn("w-4 h-4 transition-transform", tagDropdownOpen && "rotate-180")} />
                              </button>
                              
                              {/* Dropdown with existing tags */}
                              {tagDropdownOpen && filteredExistingTags.length > 0 && (
                                <div className="absolute z-50 top-full left-0 right-0 mt-1 py-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                  {filteredExistingTags.map((tag) => (
                                    <button
                                      key={tag.name}
                                      type="button"
                                      onClick={() => {
                                        setWebhookAutoTagName(tag.name);
                                        setWebhookAutoTagColor(tag.color);
                                        setTagDropdownOpen(false);
                                      }}
                                      className={cn(
                                        "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left",
                                        tag.name.toLowerCase() === webhookAutoTagName.toLowerCase().trim() && "bg-muted"
                                      )}
                                    >
                                      <span 
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: tag.color }}
                                      />
                                      <span>{tag.name}</span>
                                      {tag.name.toLowerCase() === webhookAutoTagName.toLowerCase().trim() && (
                                        <Check className="w-3 h-3 ml-auto text-foreground" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {/* Show color picker only for new tags */}
                            {isNewTag && (
                              <input
                                type="color"
                                value={webhookAutoTagColor}
                                onChange={(e) => setWebhookAutoTagColor(e.target.value)}
                                className="w-9 h-9 rounded border border-border cursor-pointer shrink-0"
                                title="Escolha a cor da nova tag"
                              />
                            )}
                            
                            {/* Show selected tag color preview when using existing tag */}
                            {!isNewTag && webhookAutoTagName.trim() && (
                              <div 
                                className="w-9 h-9 rounded border border-border shrink-0"
                                style={{ backgroundColor: webhookAutoTagColor }}
                                title="Cor da tag selecionada"
                              />
                            )}
                          </div>
                          
                          {/* New tag indicator */}
                          {isNewTag && webhookAutoTagName.trim() && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">Nova tag:</span>
                              <span 
                                className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white uppercase"
                                style={{ backgroundColor: webhookAutoTagColor }}
                              >
                                {webhookAutoTagName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <Button
                    className="w-full h-10 bg-foreground hover:bg-foreground/90 text-background"
                    onClick={createWebhook}
                  >
                    {editingWebhookId ? "Salvar alterações" : "Salvar Webhook"}
                  </Button>
                </div>
              )}

              {webhooks.length === 0 && !isCreatingWebhook ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Nenhum webhook configurado</p>
                  <p className="text-sm mt-1">Configure webhooks para integrar com sistemas externos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="p-4 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{webhook.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {webhook.type === "receive" ? "Receber" : (webhook.type as string) === "update" ? "Atualizar" : "Enviar"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                            className={cn(
                              "relative w-10 h-5 rounded-full transition-colors",
                              webhook.is_active ? "bg-emerald-500" : "bg-muted"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                                webhook.is_active ? "left-[22px]" : "left-0.5"
                              )}
                            />
                          </button>
                          <button
                            onClick={() => startEditingWebhook(webhook as any)}
                            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteWebhook(webhook.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {/* Show auto-tag badge if configured */}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <div className="relative inline-flex overflow-visible">
          <Button variant="outline" className="h-9 gap-2 bg-transparent hover:bg-muted/50 text-foreground border border-border">
            <Play className="w-4 h-4" />
            <span className="text-sm font-medium">Start</span>
          </Button>
          {(activeAutomationsCount + activeWebhooksCount) > 0 && (
            <span className="absolute -top-1 -right-1 z-10 h-5 min-w-5 px-1 text-[10px] font-bold flex items-center justify-center bg-white text-orange-600 rounded-full pointer-events-none shadow-sm border border-orange-200">
              {activeAutomationsCount + activeWebhooksCount}
            </span>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[700px] overflow-hidden p-0 bg-background border-border" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Automações</DialogTitle>
        {/* Header with tabs */}
        <div className="border-b border-border">
          <div className="flex items-center gap-3 px-6 py-4">
            <span className="text-base font-semibold text-foreground">Automações</span>
          </div>
          
          {/* Tabs - Remove email tab, keep automations and webhooks */}
          <div className="flex items-center gap-6 px-6">
            <button
              onClick={() => setActiveTab("automations")}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "automations"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Automações
              {activeAutomationsCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
                  {activeAutomationsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("webhooks")}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "webhooks"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Webhooks
              {activeWebhooksCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
                  {activeWebhooksCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("integrations")}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === "integrations"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Integrações
            </button>
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(700px-110px)]">
          {/* Integrations Tab */}
          {activeTab === "integrations" && <IntegrationsTab />}

          {/* Automations Tab */}
          {activeTab === "automations" && (
            <div className="p-6">
              {/* Active/Inactive filter */}
              <div className="flex items-center gap-2 mb-6">
                <button className="px-3 py-1.5 text-sm rounded-lg bg-foreground/10 text-foreground font-medium">
                  Ativo {activeAutomationsCount}
                </button>
                <button className="px-3 py-1.5 text-sm rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                  Inativo {automations.length - activeAutomationsCount}
                </button>
                <div className="flex-1" />
                <Button
                  onClick={() => {
                    setIsCreatingAutomation(true);
                    setSelectedTrigger("lead_moved"); // Auto-set trigger type
                  }}
                  className="bg-foreground hover:bg-foreground/90 text-background"
                  disabled={isCreatingAutomation}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar automação
                </Button>
              </div>

              {/* Create automation flow */}
              {isCreatingAutomation && (
                <div className="mb-6 p-5 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-foreground">
                      {editingAutomationId ? "Editar automação" : "Nova automação"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={resetAutomationForm}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Two-column layout: Trigger -> Action */}
                  <div className="flex items-stretch gap-3">
                    {/* Trigger Column */}
                    <div className="flex-1">
                      <div className="rounded-lg bg-background border border-border h-full">
                        <div className="flex items-center gap-2 p-3 border-b border-border">
                          <span className="text-foreground text-sm font-medium">Quando</span>
                        </div>
                        
                        <div className="p-3 space-y-2">
                          {/* Trigger type selector */}
                          <Select value={selectedTriggerType} onValueChange={(v) => {
                            setSelectedTriggerType(v);
                            setSelectedTriggerPipeline("");
                          }}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecione o gatilho..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lead_moved">
                                <div className="flex items-center gap-2">
                                  <ArrowRight className="h-4 w-4" />
                                  Lead movido para pipeline
                                </div>
                              </SelectItem>
                              <SelectItem value="grupo_entrada">
                                <div className="flex items-center gap-2">
                                  <UserPlus className="h-4 w-4" />
                                  Entrou no grupo
                                </div>
                              </SelectItem>
                              <SelectItem value="grupo_saida">
                                <div className="flex items-center gap-2">
                                  <UserMinus className="h-4 w-4" />
                                  Saiu do grupo
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Pipeline selector - only for lead_moved */}
                          {selectedTriggerType === "lead_moved" && (
                            <Select value={selectedTriggerPipeline} onValueChange={setSelectedTriggerPipeline}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Selecione a pipeline..." />
                              </SelectTrigger>
                              <SelectContent>
                                {pipelines.map((pipeline) => (
                                  <SelectItem key={pipeline.id} value={pipeline.id}>
                                    {pipeline.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Action Column */}
                    <div className="flex-1">
                      <div className="rounded-lg bg-background border border-border h-full">
                        <div className="flex items-center gap-2 p-3 border-b border-border">
                          <span className="text-foreground text-sm font-medium">Então</span>
                        </div>
                        
                        <div className="p-3 space-y-2">
                          <Select value={selectedActionOrigin} onValueChange={(v) => {
                            setSelectedActionOrigin(v);
                            setSelectedActionSubOrigin("");
                            setSelectedActionPipeline("");
                          }}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Origem..." />
                            </SelectTrigger>
                            <SelectContent>
                              {origins.map((origin) => (
                                <SelectItem key={origin.id} value={origin.id}>
                                  {origin.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select 
                            value={selectedActionSubOrigin} 
                            onValueChange={(v) => {
                              setSelectedActionSubOrigin(v);
                              setSelectedActionPipeline("");
                            }}
                            disabled={!selectedActionOrigin}
                          >
                            <SelectTrigger className="h-9 text-sm disabled:opacity-50">
                              <SelectValue placeholder="Sub-origem..." />
                            </SelectTrigger>
                            <SelectContent>
                              {subOrigins
                                .filter(s => s.origin_id === selectedActionOrigin)
                                .map((subOrigin) => (
                                  <SelectItem key={subOrigin.id} value={subOrigin.id}>
                                    {subOrigin.nome}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>

                          <Select 
                            value={selectedActionPipeline} 
                            onValueChange={setSelectedActionPipeline}
                            disabled={!selectedActionSubOrigin}
                          >
                            <SelectTrigger className="h-9 text-sm disabled:opacity-50">
                              <SelectValue placeholder="Pipeline..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getTargetPipelines(selectedActionSubOrigin).map((pipeline) => (
                                <SelectItem key={pipeline.id} value={pipeline.id}>
                                  {pipeline.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Quando</span>
                      <span className="px-1.5 py-0.5 bg-muted rounded text-foreground text-xs">
                        {selectedTriggerType === "onboarding_completed" 
                          ? "Onboarding preenchido"
                          : selectedTriggerType === "grupo_entrada"
                            ? "Entrou no grupo"
                            : selectedTriggerType === "grupo_saida"
                              ? "Saiu do grupo"
                              : selectedTriggerPipeline 
                                ? `Movido para ${getPipelineName(selectedTriggerPipeline)}`
                                : "..."}
                      </span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="px-1.5 py-0.5 bg-muted rounded text-foreground text-xs">
                        {selectedActionPipeline
                          ? `${getOriginName(selectedActionOrigin)} / ${getSubOriginName(selectedActionSubOrigin)} / ${getPipelineName(selectedActionPipeline, allPipelines)}`
                          : "..."}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={editingAutomationId ? saveAutomationEdit : createAutomation}
                      className="h-8 bg-foreground hover:bg-foreground/90 text-background text-xs"
                      disabled={selectedTriggerType === "lead_moved" && !selectedTriggerPipeline}
                    >
                      {editingAutomationId ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Existing automations list */}
              {automations.length === 0 && !isCreatingAutomation ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FolderSync className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-foreground font-medium mb-2">Nenhuma automação configurada</h3>
                  <p className="text-muted-foreground text-sm max-w-md mb-6">
                    Configure automações para mover leads automaticamente entre pipelines e origens.
                  </p>
                  <Button
                    onClick={() => {
                      setIsCreatingAutomation(true);
                      setSelectedTrigger("lead_moved");
                    }}
                    className="bg-foreground hover:bg-foreground/90 text-background"
                  >
                    Criar automação
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {automations.map((automation) => (
                    <div
                      key={automation.id}
                      className={cn(
                        "p-4 rounded-xl border transition-colors",
                        automation.is_active 
                          ? "bg-muted/50 border-border" 
                          : "bg-muted/20 border-border opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => updateAutomation(automation.id, { is_active: !automation.is_active })}
                            className={cn(
                              "relative w-11 h-6 rounded-full transition-colors",
                              automation.is_active ? "bg-foreground" : "bg-muted-foreground/30"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-background shadow-sm transition-transform",
                                automation.is_active ? "translate-x-5" : "translate-x-0"
                              )}
                            />
                          </button>
                          <div>
                            <div className="flex items-center gap-2 text-sm text-foreground">
                              <span className="font-medium">
                                {automation.trigger_type === "onboarding_completed" 
                                  ? "Onboarding preenchido"
                                  : automation.trigger_type === "grupo_entrada"
                                    ? "Entrou no grupo"
                                    : automation.trigger_type === "grupo_saida"
                                      ? "Saiu do grupo"
                                      : getPipelineName(automation.pipeline_id)}
                              </span>
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {getOriginName(automation.target_origin_id)} / {getSubOriginName(automation.target_sub_origin_id)} / {getPipelineName(automation.target_pipeline_id, allPipelines)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => startEditingAutomation(automation)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteAutomation(automation.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Webhooks Tab */}
          {activeTab === "webhooks" && (
            <div className="p-6">
              {/* Active/Inactive filter */}
              <div className="flex items-center gap-2 mb-6">
                <button className="px-3 py-1.5 text-sm rounded-lg bg-foreground/10 text-foreground font-medium">
                  Ativo {activeWebhooksCount}
                </button>
                <button className="px-3 py-1.5 text-sm rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                  Inativo {webhooks.length - activeWebhooksCount}
                </button>
                <div className="flex-1" />
                <Button
                  onClick={() => setIsCreatingWebhook(true)}
                  className="bg-foreground hover:bg-foreground/90 text-background"
                  disabled={isCreatingWebhook}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar webhook
                </Button>
              </div>

              {/* Create webhook form */}
              {isCreatingWebhook && (
                <div className="mb-6 p-5 rounded-xl bg-muted/50 border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Novo Webhook</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={resetWebhookForm}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Nome do webhook..."
                      value={webhookName}
                      onChange={(e) => setWebhookName(e.target.value)}
                      className="h-10"
                    />
                    <Select value={webhookType} onValueChange={(v: "receive" | "send" | "update") => setWebhookType(v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receive">Receber</SelectItem>
                        <SelectItem value="send">Enviar</SelectItem>
                        <SelectItem value="update">Atualizar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {webhookType === "send" && (
                    <>
                      <Input
                        placeholder="URL de destino..."
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="h-10"
                      />
                      <Select value={webhookTrigger} onValueChange={(v) => {
                        setWebhookTrigger(v);
                        setWebhookTriggerPipelineId("");
                      }}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Selecione o gatilho..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead_created">Lead criado</SelectItem>
                          <SelectItem value="lead_moved">Lead movido para pipeline</SelectItem>
                          <SelectItem value="lead_updated">Lead atualizado</SelectItem>
                          <SelectItem value="lead_deleted">Lead excluído</SelectItem>
                        </SelectContent>
                      </Select>

                      {webhookTrigger === "lead_moved" && (
                        <Select value={webhookTriggerPipelineId} onValueChange={setWebhookTriggerPipelineId}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Selecione a pipeline..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getSendTriggerPipelines().map((pipeline) => (
                              <SelectItem key={pipeline.id} value={pipeline.id}>
                                {pipeline.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </>
                  )}

                  {webhookType === "receive" && (
                    <Select 
                      value={webhookTriggerPipelineId} 
                      onValueChange={setWebhookTriggerPipelineId}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Em qual pipeline o lead vai cair?" />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelines.map((pipeline) => (
                          <SelectItem key={pipeline.id} value={pipeline.id}>
                            {pipeline.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {webhookType === "update" && (
                    <p className="text-xs text-muted-foreground">
                      O webhook de atualização não move leads entre pipelines. Apenas atualiza os dados do lead existente em qualquer pipeline desta sub-origem.
                    </p>
                  )}

                  {(webhookType === "receive" || webhookType === "update") && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                        URL gerada
                      </span>
                      <div className="flex gap-2">
                        <Input
                          value={getGeneratedWebhookUrl()}
                          readOnly
                          className="flex-1 h-9 text-xs font-mono"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                          onClick={() => copyWebhookUrl(getGeneratedWebhookUrl())}
                        >
                          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full h-10 bg-foreground hover:bg-foreground/90 text-background"
                    onClick={createWebhook}
                  >
                    Salvar Webhook
                  </Button>
                </div>
              )}

              {/* Webhooks list */}
              {webhooks.length === 0 && !isCreatingWebhook ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Webhook className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-foreground font-medium mb-2">Vamos configurar seu primeiro webhook.</h3>
                  <p className="text-muted-foreground text-sm max-w-md mb-6">
                    Conecte seus aplicativos facilmente com webhooks para enviar atualizações em tempo real, automatizar processos e turbinar suas integrações.
                  </p>
                  <Button
                    onClick={() => setIsCreatingWebhook(true)}
                    className="bg-foreground hover:bg-foreground/90 text-background"
                  >
                    Criar webhook
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Receive Webhooks */}
                  {receiveWebhooks.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Webhooks de Recebimento ({receiveWebhooks.length})
                      </span>
                      {receiveWebhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className={cn(
                            "p-4 rounded-xl border transition-colors",
                            webhook.is_active 
                              ? "bg-muted/50 border-border" 
                              : "bg-muted/20 border-border opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                                className={cn(
                                  "relative w-10 h-5 rounded-full transition-colors",
                                  webhook.is_active ? "bg-foreground" : "bg-muted-foreground/30"
                                )}
                              >
                                <span
                                  className={cn(
                                    "absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-background shadow-sm transition-transform",
                                    webhook.is_active ? "translate-x-5" : "translate-x-0"
                                  )}
                                />
                              </button>
                              <span className="text-sm font-medium text-foreground">{webhook.name}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteWebhook(webhook.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={webhook.url || ""}
                              readOnly
                              className="flex-1 h-8 text-xs font-mono"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => copyWebhookUrl(webhook.url || "")}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Send Webhooks */}
                  {sendWebhooks.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Webhooks de Envio ({sendWebhooks.length})
                      </span>
                      {sendWebhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className={cn(
                            "p-4 rounded-xl border transition-colors",
                            webhook.is_active 
                              ? "bg-muted/50 border-border" 
                              : "bg-muted/20 border-border opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleWebhook(webhook.id, webhook.is_active)}
                                className={cn(
                                  "relative w-10 h-5 rounded-full transition-colors",
                                  webhook.is_active ? "bg-foreground" : "bg-muted-foreground/30"
                                )}
                              >
                                <span
                                  className={cn(
                                    "absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-background shadow-sm transition-transform",
                                    webhook.is_active ? "translate-x-5" : "translate-x-0"
                                  )}
                                />
                              </button>
                              <div>
                                <span className="text-sm font-medium text-foreground block">{webhook.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {getTriggerLabel(webhook.trigger, webhook.trigger_pipeline_id)}
                                </span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteWebhook(webhook.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono truncate">
                            {webhook.url}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
