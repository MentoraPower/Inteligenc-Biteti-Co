import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveOriginParam } from "@/lib/origin-slugs";
import { getAvatarForName } from "@/lib/avatar";
import { CountryDialSelect } from "@/components/crm/CountryDialSelect";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Calendar, MoreVertical, Trash2, User, ArrowRightLeft, Instagram } from "lucide-react";
import WhatsApp from "@/components/icons/WhatsApp";

import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { ActivitiesBoard } from "@/components/activities/ActivitiesBoard";
import { LeadTagsManager } from "@/components/crm/LeadTagsManager";
import { LeadTrackingTimeline } from "@/components/crm/LeadTrackingTimeline";
import { LeadAnalysis } from "@/components/crm/LeadAnalysis";
import { MoveLeadDropdown } from "@/components/crm/MoveLeadDropdown";
import { EditableField } from "@/components/crm/EditableField";
import { LeadCustomFields } from "@/components/crm/LeadCustomFields";
import { CustomFieldsPanel } from "@/components/crm/CustomFieldsPanel";



import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Lead } from "@/types/crm";

interface LeadData {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  country_code: string;
  instagram: string;
  clinic_name: string | null;
  service_area: string;
  monthly_billing: string;
  weekly_attendance: string;
  workspace_type: string;
  years_experience: string;
  pipeline_id: string | null;
  sub_origin_id: string | null;
  ordem: number;
  created_at: string;
  average_ticket: number | null;
  estimated_revenue: number | null;
  can_afford: string | null;
  wants_more_info: boolean | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  ai_analysis: string | null;
  is_mql: boolean | null;
  analysis_created_at: string | null;
  biggest_difficulty: string | null;
  photo_url: string | null;
  assigned_to: string | null;
}

interface Pipeline {
  id: string;
  nome: string;
  cor: string;
}

const tabs = [
  { id: "contato", label: "Contato" },
  { id: "atividades", label: "Atividades" },
  { id: "rastreamento", label: "Rastreamento" },
];

export default function LeadDetail() {
  const { isLoading: authLoading } = useAuth("/auth");
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const originParam = searchParams.get("origin");
  const subOriginId = resolveOriginParam(originParam) || originParam;
  const searchQuery = searchParams.get("search");
  const tabParam = searchParams.get("tab");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCustomFieldsPanelOpen, setIsCustomFieldsPanelOpen] = useState(false);
  const [customFieldsRefresh, setCustomFieldsRefresh] = useState(0);

  // Build CRM URL preserving search params
  const buildCrmUrl = () => {
    const params = new URLSearchParams();
    if (subOriginId) params.set("origin", subOriginId);
    if (searchQuery) params.set("search", searchQuery);
    // Preserve view param (lista or kanban)
    const viewParam = searchParams.get("view");
    if (viewParam) params.set("view", viewParam);
    const queryString = params.toString();
    return `/crm${queryString ? `?${queryString}` : ''}`;
  };
  
  // Use URL param for tab persistence, default to "contato"
  const activeTab = tabParam && ["atividades", "contato", "rastreamento"].includes(tabParam)
    ? tabParam
    : "contato";

  const setActiveTab = (tab: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tab);
    setSearchParams(newParams, { replace: true });
  };

  useEffect(() => {
    const fetchLead = async () => {
      if (!id || authLoading) return;
      
      setIsLoading(true);
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching lead:", error);
        navigate(buildCrmUrl());
        return;
      }

      if (!data) {
        navigate(buildCrmUrl());
        return;
      }

      setLead(data);

      // Fetch pipeline info
      if (data.pipeline_id) {
        const { data: pipelineData } = await supabase
          .from("pipelines")
          .select("id, nome, cor")
          .eq("id", data.pipeline_id)
          .maybeSingle();
        
        if (pipelineData) {
          setPipeline(pipelineData);
        }
      }

      setIsLoading(false);
    };

    fetchLead();
  }, [id, navigate, authLoading, subOriginId]);

  if (authLoading) {
    return <div className="h-screen" />;
  }

  const handleDelete = async () => {
    if (!lead) return;

    setIsDeleting(true);

    const keySubOriginId = (lead.sub_origin_id ?? subOriginId) || null;

    // Optimistically update the cache immediately
    queryClient.setQueryData<Lead[]>(["crm-leads", keySubOriginId], (oldData) => {
      if (!oldData) return [];
      return oldData.filter((l) => l.id !== lead.id);
    });

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", lead.id);

    if (error) {
      console.error("Error deleting lead:", error);
      toast.error("Erro ao excluir lead");
      // Revert the optimistic update
      queryClient.invalidateQueries({ queryKey: ["crm-leads", keySubOriginId] });
      setIsDeleting(false);
      return;
    }

    toast.success("Lead excluído com sucesso");
    navigate(buildCrmUrl());
  };

  const updateLeadField = async (field: string, value: string) => {
    if (!lead) return;
    
    const { error } = await supabase
      .from("leads")
      .update({ [field]: value })
      .eq("id", lead.id);

    if (error) {
      toast.error("Erro ao atualizar campo");
      throw error;
    }

    setLead({ ...lead, [field]: value });
    toast.success("Campo atualizado");
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || value === 0) return "incompleto";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calculate estimated revenue if not stored
  const getEstimatedRevenue = () => {
    if (lead?.estimated_revenue) return lead.estimated_revenue;
    
    const weeklyAttendance = parseInt(lead?.weekly_attendance || "0") || 0;
    const averageTicket = lead?.average_ticket || 0;
    const calculated = weeklyAttendance * 4 * averageTicket;
    
    return calculated > 0 ? calculated : null;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getWorkspaceLabel = (type: string) => {
    if (type === "physical") return "Espaço Físico";
    if (type === "home") return "Domicílio/Casa";
    return type || "incompleto";
  };

  // Helper to display field value or "incompleto"
  const displayValue = (value: string | null | undefined) => {
    if (!value || value.trim() === "" || value === "Incompleto") return "incompleto";
    return value;
  };

  // Check if email is a temp/incomplete email
  const isIncompleteEmail = (email: string) => {
    return email.includes("incompleto_") && email.includes("@temp.com");
  };

  // Check if lead has incomplete essential fields (abandoned form)
  const isLeadIncomplete = (leadData: LeadData) => {
    const essentialFields = [
      leadData.service_area,
      leadData.monthly_billing,
      leadData.weekly_attendance,
      leadData.workspace_type,
      leadData.years_experience
    ];
    // Lead is incomplete if more than 2 essential fields are empty
    const emptyCount = essentialFields.filter(f => !f || f.trim() === "").length;
    return emptyCount >= 3;
  };

  if (isLoading) {
    // Same centered spinner used when switching workspaces (no janky skeleton).
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (!lead) return null;

  return (
    <>
      <div className="flex h-full">
        {/* Main content - shrinks when panel is open */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={`space-y-3 flex-1 min-w-0 pt-6 px-3 transition-all duration-300 ${isCustomFieldsPanelOpen ? 'pr-4' : ''}`}
        >
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => navigate(buildCrmUrl())}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Lista Geral
          </button>
          <span className="text-muted-foreground">&gt;</span>
          <span className="text-foreground font-medium">
            {lead.name === "Incompleto" ? "incompleto" : lead.name}
          </span>
        </div>

        {/* Header with Avatar, Name and Tags */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Avatar (gender-based, same rounded corners as the card) */}
              <img
                src={getAvatarForName(lead.name)}
                alt=""
                loading="lazy"
                className="h-10 w-10 rounded-lg object-cover flex-shrink-0 select-none pointer-events-none"
              />
              
              {/* Name and Company */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {lead.clinic_name && (
                    <p className="uppercase tracking-wide text-sm text-muted-foreground font-medium">
                      {lead.clinic_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold leading-tight">
                    {lead.name === "Incompleto" ? "incompleto" : lead.name}
                  </h1>
                </div>
              </div>
            </div>
            
            {/* Three dots menu */}
            <div className="flex items-center gap-2">

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <MoveLeadDropdown
                  leadId={lead.id}
                  leadName={lead.name}
                  currentSubOriginId={lead.sub_origin_id}
                  onMoved={() => {
                    // Navigate first (snappier), then refresh CRM list in the background
                    const keySubOriginId = (subOriginId ?? null);
                    navigate(buildCrmUrl());
                    window.setTimeout(() => {
                      queryClient.invalidateQueries({ queryKey: ["crm-leads", keySubOriginId] });
                    }, 0);
                  }}
                >
                  <DropdownMenuItem 
                    className="cursor-pointer"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Mover para outra origem
                  </DropdownMenuItem>
                </MoveLeadDropdown>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
          {/* Tags Section - directly below name */}
          <div className="pl-[44px] mt-0.5">
            <LeadTagsManager leadId={lead.id} />
          </div>
        </div>

        {/* Separator */}
        <div className="px-8 py-2">
          <div className="border-t border-black/10" />
        </div>

        {/* Tabs Navigation */}
        <LayoutGroup>
          <div className="relative">
            <div className="flex gap-6 pb-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative pb-3 text-[15px] font-medium transition-colors ${
                    activeTab === tab.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-600 to-amber-500"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </LayoutGroup>
        {/* Separator line below tabs */}
        <div className="h-px bg-border" />

        {/* Tab Content */}
        <div className="mt-4 flex-1">
          <AnimatePresence mode="wait">
            {activeTab === "atividades" && (
              <motion.div
                key="atividades"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ActivitiesBoard
                  leadId={lead.id}
                  leadName={lead.name}
                  currentPipelineId={lead.pipeline_id}
                  currentSubOriginId={lead.sub_origin_id}
                  subOriginId={lead.sub_origin_id || subOriginId}
                  onLeadMoved={() => {
                    queryClient.invalidateQueries({ queryKey: ["leads"] });
                    navigate(buildCrmUrl());
                  }}
                />
              </motion.div>
            )}

            {activeTab === "contato" && (
              <motion.div
                key="contato"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-[calc(100vh-280px)] overflow-y-auto"
              >
              <div className="space-y-6">
              {/* Contact Info */}
              <Card className="border border-black/10 dark:border-white/10 shadow-none">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Informações de Contato
                  </h3>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-5 w-5 text-neutral-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <EditableField
                        value={isIncompleteEmail(lead.email) ? "" : lead.email}
                        onSave={(value) => updateLeadField("email", value)}
                        placeholder="Digite o email"
                        inputClassName="text-[15px] font-medium"
                        displayValue={
                          isIncompleteEmail(lead.email) ? (
                            <span className="text-[15px] font-medium text-muted-foreground italic">incompleto</span>
                          ) : (
                            <span className="text-[15px] font-medium">{lead.email}</span>
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center flex-shrink-0">
                      <WhatsApp className="h-5 w-5 text-neutral-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">WhatsApp</p>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CountryDialSelect
                          value={lead.country_code}
                          onChange={(dial) => updateLeadField("country_code", dial)}
                        />
                        <EditableField
                          value={lead.whatsapp || ""}
                          onSave={(value) => updateLeadField("whatsapp", value)}
                          placeholder="Digite o WhatsApp"
                          inputClassName="text-[15px] font-medium"
                          className="flex-1 min-w-0"
                          displayValue={
                            !lead.whatsapp || lead.whatsapp === "" ? (
                              <span className="text-[15px] font-medium text-muted-foreground italic">incompleto</span>
                            ) : (
                              <span className="text-[15px] font-medium">{lead.whatsapp}</span>
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center flex-shrink-0">
                      <Instagram className="h-5 w-5 text-neutral-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">Instagram</p>
                      <EditableField
                        value={lead.instagram === "@" ? "" : lead.instagram || ""}
                        onSave={(value) => updateLeadField("instagram", value.startsWith("@") ? value : `@${value}`)}
                        placeholder="Digite o Instagram"
                        inputClassName="text-[15px] font-medium"
                        displayValue={
                          !lead.instagram || lead.instagram === "" || lead.instagram === "@" ? (
                            <span className="text-[15px] font-medium text-muted-foreground italic">incompleto</span>
                          ) : (
                            <span className="text-[15px] font-medium">{lead.instagram}</span>
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 border border-[#00000010] rounded-lg">
                    <div className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-neutral-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data de Cadastro</p>
                      <p className="text-[15px] font-medium">{formatDate(lead.created_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>


              {/* Business Info - Custom Fields - Full Width */}
              <Card className="border-0 bg-zinc-500/[0.08] shadow-none">
                <CardContent className="p-6">
                  <LeadCustomFields 
                    leadId={lead.id} 
                    subOriginId={lead.sub_origin_id}
                    onOpenManager={() => setIsCustomFieldsPanelOpen(true)}
                    refreshTrigger={customFieldsRefresh}
                  />
                </CardContent>
              </Card>
              </div>
              </motion.div>
            )}

            {activeTab === "rastreamento" && (
              <motion.div
                key="rastreamento"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-[calc(100vh-280px)] overflow-y-auto"
              >
                <LeadTrackingTimeline
                  leadId={lead.id}
                  utmData={{
                    utm_source: lead.utm_source,
                    utm_medium: lead.utm_medium,
                    utm_campaign: lead.utm_campaign,
                    utm_term: lead.utm_term,
                    utm_content: lead.utm_content,
                  }}
                  leadEmail={lead.email}
                  leadWhatsapp={lead.whatsapp}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
      
      {/* Custom Fields Panel */}
      {lead.sub_origin_id && (
        <CustomFieldsPanel
          subOriginId={lead.sub_origin_id}
          isOpen={isCustomFieldsPanelOpen}
          onClose={() => setIsCustomFieldsPanelOpen(false)}
          onFieldsChange={() => setCustomFieldsRefresh(prev => prev + 1)}
        />
      )}
    </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lead será permanentemente excluído do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
