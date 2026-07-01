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
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({} as any));
    // The connection URL carries the token (per-form), so this is per-form opt-in.
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

    const cfg = (integration.config || {}) as any;
    const fieldMap: { source: string; target: string }[] = Array.isArray(cfg.field_map) ? cfg.field_map : [];
    const rawFields: { id?: string; label?: string; value?: any }[] = Array.isArray(body?.fields) ? body.fields : [];

    // Lookup submitted values by normalized id AND label.
    const byKey: Record<string, any> = {};
    for (const f of rawFields) {
      if (f?.id) byKey[norm(f.id)] = f.value;
      if (f?.label) byKey[norm(f.label)] = f.value;
    }

    const forwardBody: Record<string, any> = {};

    // Explicit platform mapping (by field id or label).
    for (const m of fieldMap) {
      if (!m?.source || !m?.target) continue;
      const value = byKey[norm(m.source)];
      if (value === undefined || value === null || String(value).trim() === "") continue;
      const t = m.target.toLowerCase();
      forwardBody[CORE.includes(t) ? (t === "phone" ? "whatsapp" : t) : m.target] = value;
    }

    // Also pass raw fields (by label and id) so receive-webhook aliases/labels auto-map extras.
    for (const f of rawFields) {
      if (f?.label && forwardBody[f.label] === undefined) forwardBody[f.label] = f.value;
      if (f?.id && forwardBody[f.id] === undefined) forwardBody[f.id] = f.value;
    }

    // UTMs from the page URL.
    const pageUrl = String(body?.page_url || "");
    if (pageUrl) {
      try {
        const q = new URL(pageUrl).searchParams;
        for (const u of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
          const v = q.get(u);
          if (v && forwardBody[u] === undefined) forwardBody[u] = v;
        }
      } catch { /* ignore bad url */ }
    }

    // Tag + source markers.
    if (integration.tag_name) {
      forwardBody._tag_name = integration.tag_name;
      forwardBody._tag_color = integration.tag_color || "#6366f1";
    }
    forwardBody._source = "elementor";
    if (pageUrl) forwardBody._page_url = pageUrl;
    if (body?.form_name) forwardBody._form = body.form_name;

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
