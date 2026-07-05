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
      ? `${dom.sender_name || "Equipe"} <${dom.sender_local || "contato"}@${dom.domain}>`
      : null;

    const now = () => new Date().toISOString();

    // Due runs (enrollment/wake set next_run_at <= now).
    const { data: runs } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("status", "active")
      .lte("next_run_at", now())
      .order("next_run_at", { ascending: true })
      .limit(50);

    let processed = 0;
    let sent = 0;

    for (const run of runs || []) {
      const { data: auto } = await supabase
        .from("email_automations")
        .select("flow_steps, is_active")
        .eq("id", run.automation_id)
        .single();

      if (!auto || auto.is_active === false) {
        await supabase.from("automation_runs").update({ status: "done", updated_at: now() }).eq("id", run.id);
        continue;
      }

      const steps: any[] = auto.flow_steps?.steps || [];
      const { data: lead } = await supabase.from("leads").select("id, name, email").eq("id", run.lead_id).single();

      let idx: number = run.step_index;
      let guard = 0;

      // Drain all immediate (email) steps in one shot; stop at a timer (schedule a wake) or the end.
      while (guard++ < 200) {
        if (idx >= steps.length) {
          await supabase.from("automation_runs").update({ status: "done", step_index: idx, updated_at: now() }).eq("id", run.id);
          break;
        }
        const step = steps[idx];

        if (step?.type === "timer") {
          let next: string;
          if (step.mode === "datetime" && step.datetime) {
            // Configured date/time is São Paulo local (UTC-3, no DST) -> absolute UTC instant.
            const target = new Date(`${step.datetime}:00-03:00`);
            next = (isNaN(target.getTime()) || target.getTime() <= Date.now())
              ? new Date().toISOString()
              : target.toISOString();
          } else {
            next = new Date(Date.now() + delayMs(step.amount, step.unit)).toISOString();
          }
          await supabase.from("automation_runs").update({ step_index: idx + 1, next_run_at: next, updated_at: now() }).eq("id", run.id);
          await supabase.rpc("schedule_wake", { wake_at: next });
          processed++;
          break;
        }

        if (step?.type === "email") {
          if (!from) {
            const retry = new Date(Date.now() + 300_000).toISOString();
            await supabase.from("automation_runs").update({ last_error: "Nenhum domínio ativo configurado", next_run_at: retry, updated_at: now() }).eq("id", run.id);
            await supabase.rpc("schedule_wake", { wake_at: retry });
            break;
          }

          const name = lead?.name || "";
          let errMsg: string | null = null;

          if (!lead?.email) {
            errMsg = "Lead sem e-mail";
          } else if (!step.templateId) {
            errMsg = "E-mail sem template escolhido";
          } else {
            const { data: tpl } = await supabase.from("email_templates").select("subject, body_html, name").eq("id", step.templateId).single();
            if (!tpl?.body_html) {
              errMsg = "Template não encontrado";
            } else {
              const personalize = (s: string) => String(s || "").replace(/\{\{\s*name\s*\}\}/gi, name);
              const subject = personalize(step.subject || tpl.subject || tpl.name || "Novidade");
              let html = personalize(tpl.body_html);
              if (step.preheader) {
                const pre = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${personalize(step.preheader)}</div>`;
                html = /<body[^>]*>/i.test(html) ? html.replace(/(<body[^>]*>)/i, `$1${pre}`) : pre + html;
              }

              // Tracking: rewrite links (click) + inject open pixel, keyed to this send.
              const sentId = crypto.randomUUID();
              const trackBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-tracking`;
              html = html.replace(/href\s*=\s*"(https?:\/\/[^"]+)"/gi, (_m, u) => `href="${trackBase}/click/${sentId}?url=${encodeURIComponent(u)}"`);
              const pixel = `<img src="${trackBase}/open/${sentId}" width="1" height="1" alt="" style="display:none;border:0;max-height:0;max-width:0;" />`;
              html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${pixel}</body>`) : html + pixel;

              let resendId: string | null = null;
              try {
                const r: any = await resend.emails.send({ from, to: [lead.email], subject, html });
                if (r?.error) errMsg = r.error.message || String(r.error);
                else resendId = r?.data?.id ?? null;
              } catch (e) {
                errMsg = String((e as any)?.message || e);
              }
              await supabase.from("sent_emails").insert({
                id: sentId,
                lead_id: lead.id,
                lead_name: lead.name,
                lead_email: lead.email,
                subject,
                body_html: html,
                status: errMsg ? "failed" : "sent",
                resend_id: resendId,
                automation_id: run.automation_id,
                step_id: step.id,
                sent_at: now(),
              });
              if (!errMsg) sent++;
            }
          }

          idx += 1;
          processed++;
          await supabase.from("automation_runs").update({ step_index: idx, next_run_at: now(), last_error: errMsg, updated_at: now() }).eq("id", run.id);
          continue; // keep draining immediate steps
        }

        // Unknown step -> skip.
        idx += 1;
        await supabase.from("automation_runs").update({ step_index: idx, updated_at: now() }).eq("id", run.id);
      }
    }

    return json({ ok: true, due: runs?.length || 0, processed, sent });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
