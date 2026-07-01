import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET, HEAD",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET" || req.method === "HEAD") return json({ ok: true });

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({} as any));
    // Token identifies the connection (Elementor form <-> CRM integration).
    const token = String(url.searchParams.get("token") || body?.token || "").trim();
    if (!token) return json({ error: "missing token" }, 400);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: integration } = await supabase
      .from("platform_integrations")
      .select("*")
      .eq("platform", "elementor")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (!integration) return json({ ignored: true, reason: "no integration for token" });

    // The plugin already sends clean keys (name/email/phone/instagram + custom_fields)
    // mapped per-field in the Elementor editor. Just forward to receive-webhook,
    // which handles lead creation, dedupe, workspace, defaults and custom fields.
    const forwardBody = { ...body };
    delete forwardBody.token;
    // Apply the integration's tag (if configured) to the created lead.
    if (integration.tag_name) {
      forwardBody._tag_name = integration.tag_name;
      forwardBody._tag_color = integration.tag_color || "#6366f1";
    }

    const params = new URLSearchParams({ sub_origin_id: integration.sub_origin_id });
    if (integration.pipeline_id) params.set("pipeline_id", integration.pipeline_id);

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
