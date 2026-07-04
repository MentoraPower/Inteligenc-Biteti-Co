import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

const delayMs = (amount: number, unit: string) => {
  const a = Math.max(1, Number(amount) || 1);
  if (unit === "minutes") return a * 60_000;
  if (unit === "hours") return a * 3_600_000;
  return a * 86_400_000; // days
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Active sending domain (Resend) -> from address.
    const { data: dom } = await supabase
      .from("email_domains")
      .select("domain, sender_name, sender_local, is_active")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const from = dom?.domain
      ? `${dom.sender_name || "Equipe"} <${(dom.sender_local || "contato")}@${dom.domain}>`
      : null;

    const now = () => new Date().toISOString();

    // Due runs.
    const { data: runs } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("status", "active")
      .lte("next_run_at", now())
      .order("next_run_at", { ascending: true })
      .limit(25);

    let processed = 0;
    let sent = 0;

    for (const run of runs || []) {
      const { data: auto } = await supabase
        .from("email_automations")
        .select("flow_steps, is_active")
        .eq("id", run.automation_id)
        .single();

      // Automation gone or paused -> stop this run.
      if (!auto || auto.is_active === false) {
        await supabase.from("automation_runs").update({ status: "done", updated_at: now() }).eq("id", run.id);
        continue;
      }

      const steps: any[] = auto.flow_steps?.steps || [];
      if (run.step_index >= steps.length) {
        await supabase.from("automation_runs").update({ status: "done", updated_at: now() }).eq("id", run.id);
        continue;
      }

      const step = steps[run.step_index];

      // Timer: schedule the next step for later.
      if (step?.type === "timer") {
        await supabase
          .from("automation_runs")
          .update({ step_index: run.step_index + 1, next_run_at: new Date(Date.now() + delayMs(step.amount, step.unit)).toISOString(), updated_at: now() })
          .eq("id", run.id);
        processed++;
        continue;
      }

      // Email: send via Resend.
      if (step?.type === "email") {
        if (!from) {
          // No active domain configured yet — retry in 5 min.
          await supabase.from("automation_runs").update({ last_error: "Nenhum domínio ativo configurado", next_run_at: new Date(Date.now() + 300_000).toISOString(), updated_at: now() }).eq("id", run.id);
          continue;
        }

        const { data: lead } = await supabase.from("leads").select("id, name, email").eq("id", run.lead_id).single();
        const advance = (err: string | null) =>
          supabase.from("automation_runs").update({ step_index: run.step_index + 1, next_run_at: now(), last_error: err, updated_at: now() }).eq("id", run.id);

        if (!lead?.email) { await advance("Lead sem e-mail"); continue; }
        if (!step.templateId) { await advance("E-mail sem template escolhido"); continue; }

        const { data: tpl } = await supabase.from("email_templates").select("subject, body_html, name").eq("id", step.templateId).single();
        if (!tpl?.body_html) { await advance("Template não encontrado"); continue; }

        const name = lead.name || "";
        const subject = String(tpl.subject || tpl.name || "Novidade").replace(/\{\{\s*name\s*\}\}/gi, name);
        const html = String(tpl.body_html).replace(/\{\{\s*name\s*\}\}/gi, name);

        let resendId: string | null = null;
        let errMsg: string | null = null;
        try {
          const r: any = await resend.emails.send({ from, to: [lead.email], subject, html });
          if (r?.error) errMsg = r.error.message || String(r.error);
          else resendId = r?.data?.id ?? null;
        } catch (e) {
          errMsg = String((e as any)?.message || e);
        }

        await supabase.from("sent_emails").insert({
          lead_id: lead.id,
          lead_name: lead.name,
          lead_email: lead.email,
          subject,
          body_html: html,
          status: errMsg ? "failed" : "sent",
          resend_id: resendId,
          sent_at: now(),
        });

        await advance(errMsg);
        if (!errMsg) sent++;
        processed++;
        continue;
      }

      // Unknown step type -> just advance.
      await supabase.from("automation_runs").update({ step_index: run.step_index + 1, next_run_at: now(), updated_at: now() }).eq("id", run.id);
    }

    return json({ ok: true, due: runs?.length || 0, processed, sent });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
