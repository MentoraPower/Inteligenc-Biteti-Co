import { supabase } from "@/integrations/supabase/client";

export type TrackingEventType = 
  | "cadastro"
  | "mudou_pipeline"
  | "mudou_posicao"
  | "mudou_origem"
  | "chamada_recusada"
  | "webhook"
  | "formulario"
  | "atualizacao"
  | "grupo_entrada"
  | "grupo_saida";

interface TrackingEventData {
  leadId: string;
  tipo: TrackingEventType;
  titulo: string;
  descricao?: string;
  origem?: string;
  dados?: Record<string, any>;
}

/**
 * Registra um evento de rastreamento para um lead
 */
export async function trackLeadEvent({
  leadId,
  tipo,
  titulo,
  descricao,
  origem,
  dados,
}: TrackingEventData): Promise<void> {
  try {
    // Capture who performed the action (logged-in user) and stamp it on the event.
    let actor: { actor_name: string | null; actor_email: string | null } = {
      actor_name: null,
      actor_email: null,
    };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", user.id)
          .maybeSingle();
        actor = {
          actor_name: profile?.name || (user.user_metadata as any)?.name || (user.user_metadata as any)?.full_name || null,
          actor_email: profile?.email || user.email || null,
        };
      }
    } catch {
      // ignore — actor stays null
    }

    const mergedDados = { ...(dados || {}), ...actor };

    const { error } = await supabase.from("lead_tracking").insert({
      lead_id: leadId,
      tipo,
      titulo,
      descricao: descricao || null,
      origem: origem || null,
      dados: mergedDados,
    });

    if (error) {
      console.error("Error tracking lead event:", error);
    }
  } catch (err) {
    console.error("Error tracking lead event:", err);
  }
}

/**
 * Registra movimentação de pipeline
 */
export async function trackPipelineMove({
  leadId,
  fromPipelineName,
  toPipelineName,
  fromPipelineId,
  toPipelineId,
}: {
  leadId: string;
  fromPipelineName: string;
  toPipelineName: string;
  fromPipelineId: string | null;
  toPipelineId: string;
}): Promise<void> {
  await trackLeadEvent({
    leadId,
    tipo: "mudou_pipeline",
    titulo: `Movido para ${toPipelineName}`,
    descricao: fromPipelineName ? `Pipeline anterior: ${fromPipelineName}` : "Primeira atribuição de pipeline",
    dados: {
      from_pipeline_id: fromPipelineId,
      to_pipeline_id: toPipelineId,
      from_pipeline_name: fromPipelineName,
      to_pipeline_name: toPipelineName,
    },
  });
}

/**
 * Registra mudança de origem
 */
export async function trackOriginMove({
  leadId,
  fromOriginName,
  fromSubOriginName,
  toOriginName,
  toSubOriginName,
  toPipelineName,
  toSubOriginId,
  toPipelineId,
}: {
  leadId: string;
  fromOriginName?: string;
  fromSubOriginName?: string;
  toOriginName: string;
  toSubOriginName: string;
  toPipelineName: string;
  toSubOriginId: string;
  toPipelineId: string;
}): Promise<void> {
  const origem = fromSubOriginName 
    ? `${fromOriginName} > ${fromSubOriginName}`
    : undefined;

  await trackLeadEvent({
    leadId,
    tipo: "mudou_origem",
    titulo: `Movido para ${toOriginName} > ${toSubOriginName}`,
    descricao: `Pipeline: ${toPipelineName}`,
    origem,
    dados: {
      to_origin_name: toOriginName,
      to_sub_origin_name: toSubOriginName,
      to_sub_origin_id: toSubOriginId,
      to_pipeline_id: toPipelineId,
      to_pipeline_name: toPipelineName,
    },
  });
}

/**
 * Registra reordenação dentro do mesmo pipeline
 */
export async function trackPositionChange({
  leadId,
  pipelineName,
  newPosition,
}: {
  leadId: string;
  pipelineName: string;
  newPosition: number;
}): Promise<void> {
  await trackLeadEvent({
    leadId,
    tipo: "mudou_posicao",
    titulo: `Reordenado no pipeline ${pipelineName}`,
    descricao: `Nova posição: ${newPosition + 1}`,
    dados: {
      pipeline_name: pipelineName,
      new_position: newPosition,
    },
  });
}
