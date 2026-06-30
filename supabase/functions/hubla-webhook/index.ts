import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET, HEAD",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Hubla event "type" -> our integration event_type
const HUBLA_TYPE_MAP: Record<string, string> = {
  NewSale: "compra_aprovada",
  Sale: "compra_aprovada",
  PurchaseApproved: "compra_aprovada",
  AbandonedCheckout: "carrinho_abandonado",
  AbandonedCart: "carrinho_abandonado",
  Refund: "reembolso",
  Refunded: "reembolso",
  RefundedSale: "reembolso",
  RefundRequested: "reembolso",
  CanceledSale: "reembolso",
  CanceledSubscription: "reembolso",
  Chargeback: "reembolso",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET" || req.method === "HEAD") return json({ ok: true });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return json({ error: "missing token" }, 400);

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: integration } = await supabase
      .from("platform_integrations")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();
    if (!integration) return json({ error: "integration not found" }, 404);

    const body = await req.json().catch(() => ({}));
    const ev = (body?.event ?? body) as Record<string, any>;
    const hublaType = String(body?.type ?? "");
    const mapped = HUBLA_TYPE_MAP[hublaType] || null;

    // Only act on KNOWN Hubla events that match the integration's configured event.
    // Unknown event types are ignored (avoids reacting to unrelated webhooks).
    if (!mapped || mapped !== integration.event_type) {
      return json({ ignored: true, reason: `${hublaType || "?"} != ${integration.event_type}` });
    }

    // Hubla fires several events for the same action (e.g. a refund sends both
    // "RefundRequested" and "CanceledSale"). De-duplicate by transactionId + the
    // logical event so the lead/tracking isn't recorded twice.
    const transactionId = ev.transactionId ?? ev.transaction_id ?? null;
    if (transactionId) {
      const { data: dup } = await supabase
        .from("lead_tracking")
        .select("id")
        .eq("dados->>transactionId", String(transactionId))
        .eq("dados->>event_type", mapped)
        .limit(1);
      if (dup && dup.length > 0) {
        return json({ duplicate: true, transactionId });
      }
    }

    const name = ev.userName || ev.name || "Cliente";
    const email = String(ev.userEmail || ev.email || "").toLowerCase().trim();
    const phoneRaw = ev.userPhone || ev.phone || "";
    const whatsapp = String(phoneRaw)
      .replace(/^\+55\s*/, "")
      .replace(/^\+\d{1,3}\s*/, "")
      .replace(/\D/g, "");

    // Dedupe by email or whatsapp within the target sub-origin.
    let existing: { id: string } | null = null;
    if (email) {
      const { data } = await supabase
        .from("leads")
        .select("id")
        .eq("sub_origin_id", integration.sub_origin_id)
        .eq("email", email)
        .maybeSingle();
      existing = data;
    }
    if (!existing && whatsapp) {
      const { data } = await supabase
        .from("leads")
        .select("id")
        .eq("sub_origin_id", integration.sub_origin_id)
        .eq("whatsapp", whatsapp)
        .maybeSingle();
      existing = data;
    }

    let leadId: string;
    if (existing) {
      leadId = existing.id;
      await supabase
        .from("leads")
        .update({
          name,
          ...(email ? { email } : {}),
          ...(whatsapp ? { whatsapp } : {}),
          pipeline_id: integration.pipeline_id,
        })
        .eq("id", leadId);
    } else {
      const { data: inserted, error } = await supabase
        .from("leads")
        .insert({
          name,
          email: email || null,
          whatsapp: whatsapp || null,
          sub_origin_id: integration.sub_origin_id,
          pipeline_id: integration.pipeline_id,
        })
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 500);
      leadId = inserted.id;
    }

    // Apply the configured tag.
    if (integration.tag_name) {
      const { data: tagExists } = await supabase
        .from("lead_tags")
        .select("id")
        .eq("lead_id", leadId)
        .eq("name", integration.tag_name)
        .maybeSingle();
      if (!tagExists) {
        await supabase.from("lead_tags").insert({
          lead_id: leadId,
          name: integration.tag_name,
          color: integration.tag_color || "#6366f1",
        });
      }
    }

    // Tracking event.
    await supabase.from("lead_tracking").insert({
      lead_id: leadId,
      tipo: "webhook",
      titulo: `Hubla: ${integration.name}`,
      descricao: `${hublaType}${ev.totalAmount != null ? ` — R$ ${ev.totalAmount}` : ""}`,
      dados: {
        source: "hubla",
        type: hublaType,
        event_type: mapped,
        transactionId: transactionId,
        totalAmount: ev.totalAmount ?? null,
        groupName: ev.groupName ?? null,
      },
    });

    return json({ ok: true, leadId });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
