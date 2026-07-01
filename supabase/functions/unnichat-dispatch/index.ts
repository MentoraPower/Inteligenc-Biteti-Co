import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UNNI_BASE = "https://unnichat.com.br/api";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Normalize a BR phone to Unnichat's "5511999999999" format.
function normalizePhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11) return "55" + digits;
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Internal payload: { lead, sub_origin_id, pipeline_id?, trigger: 'received' | 'pipeline' }
    const { lead, sub_origin_id, pipeline_id, trigger } = await req.json();
    if (!lead || !sub_origin_id) return json({ error: "missing lead/sub_origin_id" }, 400);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: allIntegrations } = await supabase
      .from("platform_integrations")
      .select("*")
      .eq("platform", "unnichat")
      .eq("sub_origin_id", sub_origin_id)
      .eq("is_active", true);

    // Match the trigger: "lead_recebido" fires on a received lead; "lead_pipeline"
    // fires when the lead is in/added to the integration's configured pipeline.
    const integrations = (allIntegrations || []).filter((it: any) => {
      if (it.event_type === "lead_recebido") return trigger === "received";
      if (it.event_type === "lead_pipeline") return it.pipeline_id && it.pipeline_id === pipeline_id;
      return false;
    });

    if (integrations.length === 0) return json({ ok: true, dispatched: 0 });

    const results: any[] = [];
    for (const it of integrations) {
      const cfg = (it.config || {}) as Record<string, any>;
      const token = cfg.api_token;
      if (!token) { results.push({ id: it.id, skipped: "no token" }); continue; }
      const headers = { Authorization: token, "Content-Type": "application/json" };
      const phone = normalizePhone(lead.whatsapp || "");

      try {
        // 1) Create the WhatsApp contact.
        const contactRes = await fetch(`${UNNI_BASE}/contact`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: lead.name || "Lead",
            phone,
            ...(lead.email ? { email: lead.email } : {}),
            ...(cfg.tag_id ? { tags: [cfg.tag_id] } : {}),
          }),
        });
        const contact = await contactRes.json().catch(() => ({}));
        const contactId = contact?.id || contact?._id || contact?.data?.id || contact?.contact?.id;

        if (!contactId) {
          results.push({ id: it.id, error: "no contact id", status: contactRes.status, body: contact });
          continue;
        }

        // 2) Create the deal in the CRM pipeline column.
        if (cfg.crm_id && cfg.column_id) {
          await fetch(`${UNNI_BASE}/contact/${contactId}/crm`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              crm_id: cfg.crm_id,
              column_id: cfg.column_id,
              business_name: lead.name || "Lead",
            }),
          });
        }

        // 3) Ensure the tag is applied (in case it wasn't accepted on create).
        if (cfg.tag_id) {
          await fetch(`${UNNI_BASE}/contact/${contactId}/tags`, {
            method: "POST",
            headers,
            body: JSON.stringify({ tag_id: cfg.tag_id }),
          }).catch(() => {});
        }

        results.push({ id: it.id, ok: true, contactId });
      } catch (e) {
        results.push({ id: it.id, error: String(e) });
      }
    }

    return json({ ok: true, dispatched: results.length, results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
