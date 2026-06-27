import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

// Function to inline CSS from <style> tags into elements
function inlineCSS(html: string): string {
  // Extract all <style> blocks
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const styles: { [selector: string]: string } = {};
  
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    const cssContent = match[1];
    // Parse CSS rules (simplified parser for common patterns)
    const ruleRegex = /([^{]+)\{([^}]+)\}/g;
    let ruleMatch;
    while ((ruleMatch = ruleRegex.exec(cssContent)) !== null) {
      const selector = ruleMatch[1].trim();
      const declarations = ruleMatch[2].trim();
      // Handle simple selectors (class, element, id)
      if (!selector.includes(':') && !selector.includes('@') && !selector.includes(' ')) {
        styles[selector] = declarations;
      }
    }
  }
  
  let result = html;
  
  // Apply class styles inline
  for (const [selector, declarations] of Object.entries(styles)) {
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      // Match elements with this class
      const classRegex = new RegExp(`class=["']([^"']*\\b${className}\\b[^"']*)["']`, 'gi');
      result = result.replace(classRegex, (match, classes) => {
        return `${match} style="${declarations.replace(/"/g, "'")}"`;
      });
    } else if (selector.startsWith('#')) {
      const idName = selector.slice(1);
      const idRegex = new RegExp(`id=["']${idName}["']`, 'gi');
      result = result.replace(idRegex, (match) => {
        return `${match} style="${declarations.replace(/"/g, "'")}"`;
      });
    }
  }
  
  // Merge duplicate style attributes
  result = result.replace(/style="([^"]+)"\s+style="([^"]+)"/gi, (_, s1, s2) => {
    return `style="${s1}; ${s2}"`;
  });
  
  return result;
}

// Function to ensure HTML has proper document structure
function ensureCompleteHtmlStructure(html: string): string {
  let result = html.trim();
  
  // Check if already has doctype
  const hasDoctype = /^<!DOCTYPE/i.test(result);
  const hasHtmlTag = /<html[\s>]/i.test(result);
  const hasHeadTag = /<head[\s>]/i.test(result);
  const hasBodyTag = /<body[\s>]/i.test(result);
  
  // If it's already a complete HTML document, just return it
  if (hasDoctype && hasHtmlTag && hasBodyTag) {
    return result;
  }
  
  // Extract existing head content if any
  let headContent = '';
  const headMatch = result.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    headContent = headMatch[1];
    result = result.replace(/<head[^>]*>[\s\S]*?<\/head>/i, '');
  }
  
  // Extract style tags to preserve them in head
  const styleBlocks: string[] = [];
  result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, (match) => {
    styleBlocks.push(match);
    return '';
  });
  
  // Extract body content if body tag exists
  let bodyContent = result;
  const bodyMatch = result.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1];
  }
  
  // Remove any remaining html/body wrapper tags
  bodyContent = bodyContent
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim();
  
  // Build complete HTML structure
  const completeHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  ${styleBlocks.join('\n  ')}
  ${headContent}
</head>
<body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  ${bodyContent}
</body>
</html>`;
  
  return completeHtml;
}

// Function to inject tracking and preheader into email HTML
function injectEmailTracking(html: string, scheduledEmailId: string, preheader?: string): string {
  const trackingBaseUrl = `${supabaseUrl}/functions/v1/email-tracking`;
  
  // First, ensure complete HTML structure
  let trackedHtml = ensureCompleteHtmlStructure(html);
  
  // Then inline CSS for email client compatibility
  trackedHtml = inlineCSS(trackedHtml);
  
  // 1. Inject preheader at the start of <body> if provided
  if (preheader && preheader.trim()) {
    const preheaderHtml = `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>`;
    if (trackedHtml.includes("<body")) {
      // Insert after <body> tag
      trackedHtml = trackedHtml.replace(/(<body[^>]*>)/i, `$1${preheaderHtml}`);
    } else {
      // Prepend if no body tag
      trackedHtml = preheaderHtml + trackedHtml;
    }
  }
  
  // 2. Inject tracking pixel before closing </body> tag
  const trackingPixel = `<img src="${trackingBaseUrl}/open/${scheduledEmailId}" width="1" height="1" style="display:none;visibility:hidden;" alt="" />`;
  
  if (trackedHtml.includes("</body>")) {
    trackedHtml = trackedHtml.replace("</body>", `${trackingPixel}</body>`);
  } else {
    // If no body tag, append at the end
    trackedHtml += trackingPixel;
  }
  
  // 3. Wrap all links with tracking redirect
  // Match href="..." patterns and wrap the URL
  const linkRegex = /href=["']([^"']+)["']/gi;
  trackedHtml = trackedHtml.replace(linkRegex, (match, url) => {
    // Skip mailto:, tel:, and anchor links
    if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("#")) {
      return match;
    }
    // Skip tracking URL itself to avoid recursion
    if (url.includes("/email-tracking/")) {
      return match;
    }
    const trackedUrl = `${trackingBaseUrl}/click/${scheduledEmailId}?url=${encodeURIComponent(url)}`;
    return `href="${trackedUrl}"`;
  });
  
  return trackedHtml;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[ProcessScheduledEmails] Starting scheduled email processing...");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get email settings
    const { data: settings } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    const fromName = settings?.from_name || "Emilly";
    const fromEmail = settings?.from_email || "emilly@biteti.com.br";

    // Fetch all pending scheduled emails that are due
    const now = new Date().toISOString();
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .limit(50);

    if (fetchError) {
      console.error("[ProcessScheduledEmails] Error fetching scheduled emails:", fetchError);
      throw fetchError;
    }

    if (!scheduledEmails || scheduledEmails.length === 0) {
      console.log("[ProcessScheduledEmails] No scheduled emails due for sending");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No emails to process" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ProcessScheduledEmails] Found ${scheduledEmails.length} email(s) to process`);

    let sentCount = 0;
    let failedCount = 0;

    for (const email of scheduledEmails) {
      try {
        console.log(`[ProcessScheduledEmails] Processing email for ${email.lead_email} (scheduled for ${email.scheduled_for})`);

        // Check if this is a "registered_no_group" automation - if so, verify lead hasn't joined the group
        const { data: automation } = await supabase
          .from("email_automations")
          .select("flow_steps")
          .eq("id", email.automation_id)
          .single();

        if (automation?.flow_steps) {
          const flowSteps = automation.flow_steps as any[];
          const triggerNode = flowSteps.find((step: any) => step?.type === "trigger");
          const triggers = triggerNode?.data?.triggers as any[] | null;
          
          // Check if this automation uses registered_no_group trigger
          const hasRegisteredNoGroupTrigger = triggers?.some((t: any) => t?.type === "registered_no_group");
          
          if (hasRegisteredNoGroupTrigger) {
            // Check if lead has already joined a group (grupo_entrada tracking)
            const { data: trackingEntries } = await supabase
              .from("lead_tracking")
              .select("id")
              .eq("lead_id", email.lead_id)
              .eq("tipo", "grupo_entrada")
              .limit(1);

            if (trackingEntries && trackingEntries.length > 0) {
              console.log(`[ProcessScheduledEmails] ⏭️ Skipping email for ${email.lead_email} - lead already joined a group`);
              
              // Cancel this scheduled email
              await supabase
                .from("scheduled_emails")
                .update({ 
                  status: "cancelled", 
                  cancelled_at: new Date().toISOString(),
                  cancel_reason: "Lead já entrou no grupo antes do envio"
                })
                .eq("id", email.id);

              continue;
            }
          }
        }

        console.log(`[ProcessScheduledEmails] Sending email to ${email.lead_email}`);

        // Inject tracking and preheader into the email HTML
        const trackedHtml = injectEmailTracking(email.body_html, email.id, email.preheader);
        console.log(`[ProcessScheduledEmails] Tracking injected for email ${email.id}`);

        // Send email via Resend
        const emailResponse = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [email.lead_email],
          subject: email.subject,
          html: trackedHtml,
        });

        const resendError = (emailResponse as any)?.error;
        if (resendError) {
          throw new Error(
            typeof resendError === "string"
              ? resendError
              : resendError?.message || "Erro desconhecido ao enviar e-mail"
          );
        }

        const resendId = (emailResponse as any)?.data?.id ?? null;

        // Update scheduled email status to sent
        await supabase
          .from("scheduled_emails")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", email.id);

        // Record in sent_emails (with tracked HTML)
        await supabase.from("sent_emails").insert({
          lead_id: email.lead_id,
          lead_name: email.lead_name,
          lead_email: email.lead_email,
          subject: email.subject,
          body_html: trackedHtml,
          status: "sent",
          resend_id: resendId,
          sent_at: new Date().toISOString(),
        });

        console.log(`[ProcessScheduledEmails] ✅ Email sent successfully to ${email.lead_email}`);
        sentCount++;
      } catch (emailError: any) {
        console.error(`[ProcessScheduledEmails] ❌ Failed to send email to ${email.lead_email}:`, emailError);

        // Update scheduled email status to failed
        await supabase
          .from("scheduled_emails")
          .update({ status: "failed" })
          .eq("id", email.id);

        // Record failed attempt
        await supabase.from("sent_emails").insert({
          lead_id: email.lead_id,
          lead_name: email.lead_name,
          lead_email: email.lead_email,
          subject: email.subject,
          body_html: email.body_html,
          status: "failed",
          error_message: emailError?.message,
        });

        failedCount++;
      }
    }

    console.log(`[ProcessScheduledEmails] Processing complete. Sent: ${sentCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: scheduledEmails.length,
        sent: sentCount,
        failed: failedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[ProcessScheduledEmails] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
