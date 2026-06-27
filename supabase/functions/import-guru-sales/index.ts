import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SaleData {
  name: string;
  email: string;
  phone: string;
  value?: number;
  offerName?: string;
}

interface RequestBody {
  sales: SaleData[];
  subOriginId: string;
  pipelineEntradaId: string;
  pipelineComprouGuruId: string;
}

// Normalize phone number for comparison (keep last 9 digits)
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-9);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { sales, subOriginId, pipelineEntradaId, pipelineComprouGuruId } = body;

    if (!sales || !Array.isArray(sales) || sales.length === 0) {
      return new Response(
        JSON.stringify({ error: "No sales data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[import-guru-sales] Processing ${sales.length} sales`);
    console.log(`[import-guru-sales] SubOrigin: ${subOriginId}, Entrada: ${pipelineEntradaId}, Comprou: ${pipelineComprouGuruId}`);

    // Fetch all leads from the sub-origin for matching
    const { data: allLeads, error: leadsError } = await supabase
      .from("leads")
      .select("id, name, email, whatsapp, pipeline_id")
      .eq("sub_origin_id", subOriginId);

    if (leadsError) {
      console.error("[import-guru-sales] Error fetching leads:", leadsError);
      throw leadsError;
    }

    console.log(`[import-guru-sales] Found ${allLeads?.length || 0} existing leads in sub-origin`);

    const stats = {
      total: sales.length,
      moved: 0,
      alreadyInComprou: 0,
      created: 0,
      errors: 0,
      errorDetails: [] as string[],
    };

    for (const sale of sales) {
      try {
        const email = sale.email?.trim().toLowerCase();
        const phoneNormalized = normalizePhone(sale.phone || "");

        // Find existing lead by email or phone
        let matchedLead = allLeads?.find(
          (lead) => lead.email?.toLowerCase() === email
        );

        if (!matchedLead && phoneNormalized.length >= 8) {
          matchedLead = allLeads?.find(
            (lead) => normalizePhone(lead.whatsapp || "") === phoneNormalized
          );
        }

        if (matchedLead) {
          if (matchedLead.pipeline_id === pipelineComprouGuruId) {
            // Already in "Comprou Guru" - do nothing
            console.log(`[import-guru-sales] Lead "${matchedLead.name}" already in Comprou Guru`);
            stats.alreadyInComprou++;
          } else if (matchedLead.pipeline_id === pipelineEntradaId) {
            // In "Entrada" - move to "Comprou Guru"
            const { error: updateError } = await supabase
              .from("leads")
              .update({ pipeline_id: pipelineComprouGuruId })
              .eq("id", matchedLead.id);

            if (updateError) {
              console.error(`[import-guru-sales] Error moving lead ${matchedLead.id}:`, updateError);
              stats.errors++;
              stats.errorDetails.push(`Move failed for ${email}: ${updateError.message}`);
            } else {
              console.log(`[import-guru-sales] Moved lead "${matchedLead.name}" to Comprou Guru`);
              
              // Record tracking
              await supabase.from("lead_tracking").insert({
                lead_id: matchedLead.id,
                tipo: "mudou_pipeline",
                titulo: "Movido para Comprou Guru",
                descricao: `Lead movido automaticamente após compra no Guru (${sale.offerName || "Power Academy"})`,
                origem: "import-guru-sales",
                dados: {
                  from_pipeline: pipelineEntradaId,
                  to_pipeline: pipelineComprouGuruId,
                  sale_value: sale.value,
                },
              });

              stats.moved++;
            }
          } else {
            // In another pipeline - move to "Comprou Guru"
            const { error: updateError } = await supabase
              .from("leads")
              .update({ pipeline_id: pipelineComprouGuruId })
              .eq("id", matchedLead.id);

            if (updateError) {
              stats.errors++;
              stats.errorDetails.push(`Move failed for ${email}: ${updateError.message}`);
            } else {
              console.log(`[import-guru-sales] Moved lead "${matchedLead.name}" from other pipeline to Comprou Guru`);
              
              await supabase.from("lead_tracking").insert({
                lead_id: matchedLead.id,
                tipo: "mudou_pipeline",
                titulo: "Movido para Comprou Guru",
                descricao: `Lead movido automaticamente após compra no Guru (${sale.offerName || "Power Academy"})`,
                origem: "import-guru-sales",
                dados: {
                  from_pipeline: matchedLead.pipeline_id,
                  to_pipeline: pipelineComprouGuruId,
                  sale_value: sale.value,
                },
              });

              stats.moved++;
            }
          }
        } else {
          // Lead doesn't exist - create new one in "Comprou Guru"
          const phoneWithCountry = sale.phone?.startsWith("55")
            ? sale.phone
            : `55${sale.phone?.replace(/\D/g, "")}`;

          const { data: newLead, error: insertError } = await supabase
            .from("leads")
            .insert({
              name: sale.name || "Sem nome",
              email: email || "",
              whatsapp: phoneWithCountry || "",
              country_code: "55",
              instagram: "",
              service_area: "",
              monthly_billing: "",
              weekly_attendance: "",
              workspace_type: "",
              years_experience: "",
              sub_origin_id: subOriginId,
              pipeline_id: pipelineComprouGuruId,
              estimated_revenue: sale.value || null,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error(`[import-guru-sales] Error creating lead for ${email}:`, insertError);
            stats.errors++;
            stats.errorDetails.push(`Create failed for ${email}: ${insertError.message}`);
          } else {
            console.log(`[import-guru-sales] Created new lead "${sale.name}" in Comprou Guru`);
            
            // Record tracking for new lead
            if (newLead?.id) {
              await supabase.from("lead_tracking").insert({
                lead_id: newLead.id,
                tipo: "cadastro",
                titulo: "Lead criado via importação Guru",
                descricao: `Lead criado automaticamente após compra no Guru (${sale.offerName || "Power Academy"})`,
                origem: "import-guru-sales",
                dados: {
                  pipeline: pipelineComprouGuruId,
                  sale_value: sale.value,
                },
              });
            }

            stats.created++;
          }
        }
      } catch (saleError) {
        console.error(`[import-guru-sales] Error processing sale:`, saleError);
        stats.errors++;
        stats.errorDetails.push(`Processing error: ${saleError}`);
      }
    }

    console.log(`[import-guru-sales] Completed. Stats:`, stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        message: `Processadas ${stats.total} vendas: ${stats.moved} movidos, ${stats.alreadyInComprou} já em Comprou, ${stats.created} criados, ${stats.errors} erros`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[import-guru-sales] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
