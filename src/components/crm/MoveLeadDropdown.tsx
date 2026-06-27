import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { triggerWebhook } from "@/lib/webhooks";
import { trackOriginMove } from "@/lib/leadTracking";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ChevronRight, FolderOpen, Folder, ArrowRight } from "lucide-react";

interface Origin {
  id: string;
  nome: string;
}

interface SubOrigin {
  id: string;
  nome: string;
  origin_id: string;
}

interface Pipeline {
  id: string;
  nome: string;
  sub_origin_id: string | null;
}

interface MoveLeadDropdownProps {
  children: React.ReactNode;
  leadId: string;
  leadName: string;
  currentSubOriginId: string | null;
  onMoved?: () => void;
}

export function MoveLeadDropdown({
  children,
  leadId,
  leadName,
  currentSubOriginId,
  onMoved,
}: MoveLeadDropdownProps) {
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [subOrigins, setSubOrigins] = useState<SubOrigin[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch all data when dropdown opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      const [originsRes, subOriginsRes, pipelinesRes] = await Promise.all([
        supabase.from("crm_origins").select("*").order("ordem"),
        supabase.from("crm_sub_origins").select("*").order("ordem"),
        supabase.from("pipelines").select("*").order("ordem"),
      ]);

      if (originsRes.data) setOrigins(originsRes.data);
      if (subOriginsRes.data) setSubOrigins(subOriginsRes.data);
      if (pipelinesRes.data) setPipelines(pipelinesRes.data);
    };

    fetchData();
  }, [isOpen]);

  const handleMove = async (targetSubOriginId: string, pipelineId: string, pipelineName: string) => {
    // Close menu immediately to avoid UI feeling stuck while network calls happen
    setIsOpen(false);
    await new Promise((r) => setTimeout(r, 0));

    try {
      // Fetch current lead with a minimal payload (avoid heavy fields like ai_analysis)
      const { data: currentLead, error: currentLeadError } = await supabase
        .from("leads")
        .select(
          "id,name,email,whatsapp,instagram,service_area,monthly_billing,weekly_attendance,workspace_type,years_experience,clinic_name,average_ticket,estimated_revenue,is_mql,created_at,sub_origin_id,pipeline_id"
        )
        .eq("id", leadId)
        .maybeSingle();

      if (currentLeadError) {
        console.error("Error fetching lead before move:", currentLeadError);
      }

      const previousPipelineId = (currentLead as any)?.pipeline_id ?? null;
      const previousSubOriginId = (currentLead as any)?.sub_origin_id ?? null;

      const { error } = await supabase
        .from("leads")
        .update({
          sub_origin_id: targetSubOriginId,
          pipeline_id: pipelineId,
        })
        .eq("id", leadId);

      if (error) throw error;

      // Get origin and sub-origin names for tracking
      const targetSubOrigin = subOrigins.find(so => so.id === targetSubOriginId);
      const targetOrigin = origins.find(o => o.id === targetSubOrigin?.origin_id);
      
      // Get previous origin/sub-origin names
      const prevSubOrigin = subOrigins.find(so => so.id === previousSubOriginId);
      const prevOrigin = origins.find(o => o.id === prevSubOrigin?.origin_id);

      // Track origin move
      trackOriginMove({
        leadId,
        fromOriginName: prevOrigin?.nome,
        fromSubOriginName: prevSubOrigin?.nome,
        toOriginName: targetOrigin?.nome || "Desconhecido",
        toSubOriginName: targetSubOrigin?.nome || "Desconhecido",
        toPipelineName: pipelineName,
        toSubOriginId: targetSubOriginId,
        toPipelineId: pipelineId,
      }).catch((e) => console.error("Error tracking origin move:", e));

      // Trigger webhook/email automation (fire and forget)
      const movedLead = {
        ...(currentLead || { id: leadId, name: leadName }),
        sub_origin_id: targetSubOriginId,
        pipeline_id: pipelineId,
      };

      triggerWebhook({
        trigger: "lead_moved",
        lead: movedLead as any,
        pipeline_id: pipelineId,
        previous_pipeline_id: previousPipelineId,
        sub_origin_id: targetSubOriginId,
      }).catch((e) => console.error("Error triggering lead_moved webhook:", e));

      toast.success(`Lead movido para ${pipelineName}`);
      onMoved?.();
    } catch (error: any) {
      console.error("Error moving lead:", error);
      toast.error(`Erro ao mover lead: ${error.message}`);
    }
  };

  const getSubOriginsForOrigin = (originId: string) => {
    return subOrigins.filter(
      (so) => so.origin_id === originId && so.id !== currentSubOriginId
    );
  };

  const getPipelinesForSubOrigin = (subOriginId: string) => {
    return pipelines.filter((p) => p.sub_origin_id === subOriginId);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground">
            Mover <span className="font-medium text-foreground">{leadName}</span>
          </p>
        </div>
        <DropdownMenuSeparator />

        {origins.map((origin) => {
          const subOriginsForOrigin = getSubOriginsForOrigin(origin.id);
          
          if (subOriginsForOrigin.length === 0) return null;

          return (
            <DropdownMenuSub key={origin.id}>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
                {origin.nome}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {subOriginsForOrigin.map((subOrigin) => {
                  const pipelinesForSubOrigin = getPipelinesForSubOrigin(subOrigin.id);

                  if (pipelinesForSubOrigin.length === 0) {
                    return (
                      <DropdownMenuItem 
                        key={subOrigin.id} 
                        disabled
                        className="text-muted-foreground"
                      >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        {subOrigin.nome} (sem pipelines)
                      </DropdownMenuItem>
                    );
                  }

                  return (
                    <DropdownMenuSub key={subOrigin.id}>
                      <DropdownMenuSubTrigger className="cursor-pointer">
                        <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                        {subOrigin.nome}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44">
                        {pipelinesForSubOrigin.map((pipeline) => (
                          <DropdownMenuItem
                            key={pipeline.id}
                            className="cursor-pointer"
                            onClick={() => handleMove(subOrigin.id, pipeline.id, pipeline.nome)}
                          >
                            <ArrowRight className="h-4 w-4 mr-2 text-muted-foreground" />
                            {pipeline.nome}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
