import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // items: [{ lead: { name, email, whatsapp, instagram }, custom: [{ field_id, response_value }] }]
    const { sub_origin_id, pipeline_id, items } = await req.json();
    if (!sub_origin_id || !pipeline_id || !Array.isArray(items) || items.length === 0) {
      return json({ error: "missing sub_origin_id / pipeline_id / items" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const chunkSize = 300;
    let inserted = 0;
    let responsesInserted = 0;

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const { data: insertedLeads, error } = await supabase
        .from("leads")
        .insert(chunk.map((c: any) => ({ ...c.lead, sub_origin_id, pipeline_id })))
        .select("id");
      if (error) return json({ error: error.message, insertedSoFar: inserted }, 500);

      const responses: { lead_id: string; field_id: string; response_value: string }[] = [];
      (insertedLeads || []).forEach((l: any, idx: number) => {
        (chunk[idx].custom || []).forEach((c: any) => {
          if (c.field_id && c.response_value != null && String(c.response_value).trim() !== "") {
            responses.push({ lead_id: l.id, field_id: c.field_id, response_value: c.response_value });
          }
        });
      });
      if (responses.length) {
        await supabase.from("lead_custom_field_responses").insert(responses);
        responsesInserted += responses.length;
      }

      inserted += chunk.length;
    }

    return json({ ok: true, inserted, responsesInserted });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
