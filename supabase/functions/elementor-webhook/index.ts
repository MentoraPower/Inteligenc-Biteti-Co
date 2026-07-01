import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET, HEAD",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORE = ["name", "email", "whatsapp", "phone", "instagram"];

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const norm = (s: string) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET" || req.method === "HEAD") return json({ ok: true });

  try {
    const body = await req.json().catch(() => ({}));
    const formId = String(body?.form_id ?? "").trim();
    if (!formId) return json({ error: "missing form_id" }, 400);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Bind the Elementor form to a CRM integration by the form_id.
    const { data: integration } = await supabase
      .from("platform_integrations")
      .select("*")
      .eq("platform", "elementor")
      .eq("config->>form_id", formId)
      .eq("is_active", true)
      .maybeSingle();

    if (!integration) return json({ ignored: true, reason: `no integration for form_id ${formId}` });

    const cfg = (integration.config || {}) as any;
    const fieldMap: { source: string; target: string }[] = Array.isArray(cfg.field_map) ? cfg.field_map : [];

    // The plugin sends: { form_id, form_name, fields: [{ id, label, value }] }
    const rawFields: { id?: string; label?: string; value?: any }[] = Array.isArray(body?.fields) ? body.fields : [];

    // Build a normalized lookup by id AND by label so the map can reference either.
    const byKey: Record<string, any> = {};
    for (const f of rawFields) {
      if (f?.id) byKey[norm(f.id)] = f.value;
      if (f?.label) byKey[norm(f.label)] = f.value;
    }

    // Apply the mapping configured in the platform.
    const mapped: Record<string, any> = {};
    const customFields: Record<string, any> = {};
    for (const m of fieldMap) {
      if (!m?.source || !m?.target) continue;
      const value = byKey[norm(m.source)];
      if (value === undefined || value === null || String(value).trim() === "") continue;
      const target = m.target;
      if (CORE.includes(target.toLowerCase())) {
        mapped[target.toLowerCase() === "phone" ? "whatsapp" : target.toLowerCase()] = value;
      } else {
        customFields[target] = value;
      }
    }

    // Forward the clean payload to receive-webhook, which handles lead creation,
    // dedupe, workspace resolution, required-column defaults and custom fields.
    const params = new URLSearchParams({ sub_origin_id: integration.sub_origin_id });
    if (integration.pipeline_id) params.set("pipeline_id", integration.pipeline_id);

    const forwardBody: Record<string, any> = { ...mapped };
    if (Object.keys(customFields).length) forwardBody.custom_fields = customFields;
    // Include the raw fields too, so receive-webhook aliases / label-matching can
    // catch anything not explicitly mapped.
    for (const f of rawFields) {
      if (f?.label) forwardBody[f.label] = f.value;
      if (f?.id) forwardBody[f.id] = f.value;
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/receive-webhook?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(forwardBody),
    });
    const out = await res.json().catch(() => ({}));

    return json({ ok: true, forwarded: out });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
