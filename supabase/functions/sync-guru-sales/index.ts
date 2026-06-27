import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GuruTransaction {
  id: string;
  status: string;
  product: {
    name: string;
    id: string;
  };
  contact: {
    name: string;
    email: string;
    phone_number: string;
  };
  dates: {
    created_at: string;
    updated_at: string;
  };
}

interface GuruApiResponse {
  data: GuruTransaction[];
  meta?: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const guruToken = Deno.env.get("GURU_API_TOKEN");
    if (!guruToken) {
      throw new Error("GURU_API_TOKEN not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Configuration
    const SUB_ORIGIN_ID = "06828c22-3c33-477a-b9cf-72125b951d59"; // Rev. Power Academy
    const PIPELINE_ENTRADA_ID = "bc19894b-9a8d-4da8-beaa-f45f66650526";
    const PIPELINE_COMPROU_GURU_ID = "459f02f0-43b1-42c2-a57b-0f4db0d751d9";
    const OFFER_KEY = "renovacao-power-womam";
    const START_DATE = "2026-01-04";
    const END_DATE = "2026-01-06";

    console.log(`[sync-guru-sales] Starting sync for offer "${OFFER_KEY}" from ${START_DATE} to ${END_DATE}`);

    // Fetch ALL transactions from Guru API with cursor-based pagination
    const allTransactions: GuruTransaction[] = [];
    let nextCursor: string | null = null;
    let pageNum = 0;

    do {
      pageNum++;
      const guruUrl = new URL("https://digitalmanager.guru/api/v2/transactions");
      guruUrl.searchParams.set("offer_key", OFFER_KEY);
      guruUrl.searchParams.set("ordered_at_ini", START_DATE);
      guruUrl.searchParams.set("ordered_at_end", END_DATE);
      guruUrl.searchParams.set("status", "approved");
      guruUrl.searchParams.set("per_page", "100");
      
      if (nextCursor) {
        guruUrl.searchParams.set("cursor", nextCursor);
      }

      console.log(`[sync-guru-sales] Fetching page ${pageNum} from Guru: ${guruUrl.toString()}`);

      const guruResponse = await fetch(guruUrl.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${guruToken}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!guruResponse.ok) {
        const errorText = await guruResponse.text();
        console.error(`[sync-guru-sales] Guru API error: ${guruResponse.status} - ${errorText}`);
        throw new Error(`Guru API error: ${guruResponse.status} - ${errorText}`);
      }

      const guruData = await guruResponse.json();
      
      // Log full response structure for debugging
      if (pageNum === 1) {
        console.log(`[sync-guru-sales] Full response keys:`, Object.keys(guruData));
        console.log(`[sync-guru-sales] total_rows from API:`, guruData.total_rows);
      }
      
      const transactions = guruData.data || [];
      
      if (Array.isArray(transactions) && transactions.length > 0) {
        allTransactions.push(...transactions);
      }
      
      // Use cursor-based pagination
      const hasMore = guruData.has_more_pages === true;
      nextCursor = hasMore ? guruData.next_cursor : null;
      
      console.log(`[sync-guru-sales] Page ${pageNum}: got ${transactions.length} transactions, total so far: ${allTransactions.length}, has_more: ${hasMore}`);
      
    } while (nextCursor);

    console.log(`[sync-guru-sales] Guru returned ${allTransactions.length} total transactions across all pages`);

    const results = {
      total_sales: allTransactions.length,
      moved_to_comprou: 0,
      already_in_comprou: 0,
      created_new: 0,
      errors: [] as string[],
      details: [] as { email: string; action: string; name: string }[],
    };

    if (allTransactions.length === 0) {
      console.log("[sync-guru-sales] No sales found for the specified criteria");
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process each sale
    for (const sale of allTransactions) {
      const contact = sale.contact;
      const email = contact.email?.toLowerCase()?.trim();
      const phone = contact.phone_number?.replace(/\D/g, "");
      const name = contact.name || "Lead Guru";

      if (!email && !phone) {
        results.errors.push(`Sale ${sale.id}: No email or phone found`);
        continue;
      }

      console.log(`[sync-guru-sales] Processing sale: ${name} (${email}, ${phone})`);

      try {
        // Check if lead exists in this sub-origin
        let query = supabase
          .from("leads")
          .select("id, pipeline_id, name, email, whatsapp")
          .eq("sub_origin_id", SUB_ORIGIN_ID);

        // Search by email OR phone
        if (email && phone) {
          query = query.or(`email.ilike.${email},whatsapp.ilike.%${phone}%`);
        } else if (email) {
          query = query.ilike("email", email);
        } else if (phone) {
          query = query.ilike("whatsapp", `%${phone}%`);
        }

        const { data: existingLeads, error: searchError } = await query;

        if (searchError) {
          console.error(`[sync-guru-sales] Error searching lead: ${searchError.message}`);
          results.errors.push(`Sale ${sale.id}: Search error - ${searchError.message}`);
          continue;
        }

        if (existingLeads && existingLeads.length > 0) {
          const lead = existingLeads[0];
          
          if (lead.pipeline_id === PIPELINE_COMPROU_GURU_ID) {
            // Already in "Comprou Guru"
            console.log(`[sync-guru-sales] Lead ${lead.name} already in Comprou Guru`);
            results.already_in_comprou++;
            results.details.push({ email: email || phone, action: "already_in_comprou", name: lead.name });
          } else {
            // Move to "Comprou Guru"
            const { error: updateError } = await supabase
              .from("leads")
              .update({ pipeline_id: PIPELINE_COMPROU_GURU_ID })
              .eq("id", lead.id);

            if (updateError) {
              console.error(`[sync-guru-sales] Error moving lead: ${updateError.message}`);
              results.errors.push(`Sale ${sale.id}: Move error - ${updateError.message}`);
              continue;
            }

            // Create tracking entry
            await supabase.from("lead_tracking").insert({
              lead_id: lead.id,
              tipo: "movimentacao",
              titulo: "Movido para Comprou Guru",
              descricao: `Lead movido automaticamente após compra no Guru (Oferta: ${OFFER_KEY})`,
              origem: "sync-guru-sales",
              dados: { 
                from_pipeline: lead.pipeline_id,
                to_pipeline: PIPELINE_COMPROU_GURU_ID,
                guru_sale_id: sale.id,
                sale_date: sale.dates.created_at
              }
            });

            console.log(`[sync-guru-sales] Moved lead ${lead.name} to Comprou Guru`);
            results.moved_to_comprou++;
            results.details.push({ email: email || phone, action: "moved_to_comprou", name: lead.name });
          }
        } else {
          // Create new lead in "Comprou Guru"
          const { error: insertError } = await supabase.from("leads").insert({
            name: name,
            email: email || "",
            whatsapp: phone || "",
            instagram: "",
            monthly_billing: "",
            service_area: "",
            weekly_attendance: "",
            workspace_type: "",
            years_experience: "",
            sub_origin_id: SUB_ORIGIN_ID,
            pipeline_id: PIPELINE_COMPROU_GURU_ID,
          });

          if (insertError) {
            console.error(`[sync-guru-sales] Error creating lead: ${insertError.message}`);
            results.errors.push(`Sale ${sale.id}: Create error - ${insertError.message}`);
            continue;
          }

          console.log(`[sync-guru-sales] Created new lead ${name} in Comprou Guru`);
          results.created_new++;
          results.details.push({ email: email || phone, action: "created_new", name });
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[sync-guru-sales] Error processing sale ${sale.id}:`, error);
        results.errors.push(`Sale ${sale.id}: ${errMsg}`);
      }
    }

    console.log(`[sync-guru-sales] Sync complete:`, results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[sync-guru-sales] Fatal error:", error);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
