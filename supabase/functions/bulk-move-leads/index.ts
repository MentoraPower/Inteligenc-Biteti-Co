import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { fromPipelineName, toPipelineId, trackingType } = await req.json();

    console.log(`[Bulk Move] Moving leads from "${fromPipelineName}" to pipeline ${toPipelineId} where tracking type = ${trackingType}`);

    // Get leads that have the tracking type and are in the source pipeline
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select(`
        id,
        name,
        pipeline_id,
        pipelines!inner(nome)
      `)
      .ilike("pipelines.nome", `%${fromPipelineName}%`);

    if (leadsError) {
      throw leadsError;
    }

    // Filter leads that have the tracking type
    const leadIds = leads?.map(l => l.id) || [];
    
    if (leadIds.length === 0) {
      return new Response(JSON.stringify({ moved: 0, message: "No leads found in source pipeline" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check which leads have the tracking event
    const { data: trackingData, error: trackingError } = await supabase
      .from("lead_tracking")
      .select("lead_id")
      .eq("tipo", trackingType)
      .in("lead_id", leadIds);

    if (trackingError) {
      throw trackingError;
    }

    const leadsWithTracking = [...new Set(trackingData?.map(t => t.lead_id) || [])];

    if (leadsWithTracking.length === 0) {
      return new Response(JSON.stringify({ moved: 0, message: "No leads with tracking event found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Bulk Move] Found ${leadsWithTracking.length} leads to move`);

    // Update all leads
    const { error: updateError } = await supabase
      .from("leads")
      .update({ pipeline_id: toPipelineId })
      .in("id", leadsWithTracking);

    if (updateError) {
      throw updateError;
    }

    // Create tracking entries for the bulk move
    const trackingEntries = leadsWithTracking.map(leadId => ({
      lead_id: leadId,
      tipo: "mudou_pipeline",
      titulo: "Movido em lote para Entrou no grupo",
      descricao: "Movimentação manual em lote",
      origem: "sistema",
    }));

    await supabase.from("lead_tracking").insert(trackingEntries);

    console.log(`[Bulk Move] ✅ Moved ${leadsWithTracking.length} leads successfully`);

    return new Response(JSON.stringify({ 
      moved: leadsWithTracking.length, 
      message: `${leadsWithTracking.length} leads moved successfully` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Bulk Move] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
