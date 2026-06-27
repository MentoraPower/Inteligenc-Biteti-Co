import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Auth helper - verifies JWT and returns user claims
async function verifyAuth(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims?.sub) {
    return null;
  }
  
  return { userId: data.claims.sub as string };
}

interface SendEmailRequest {
  leadId: string;
  leadName: string;
  leadEmail: string;
  templateId?: string;
  subject?: string;
  bodyHtml?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const auth = await verifyAuth(req);
    if (!auth) {
      console.log("[send-email] Unauthorized request - no valid JWT");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    console.log(`[send-email] Authenticated user: ${auth.userId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { leadId, leadName, leadEmail, templateId, subject: directSubject, bodyHtml: directBodyHtml }: SendEmailRequest = await req.json();

    console.log("Received email request:", { leadId, leadName, leadEmail, templateId, hasDirectContent: !!directBodyHtml });

    // Get email settings
    const { data: settings } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    const fromName = settings?.from_name || "Emilly";
    const fromEmail = settings?.from_email || "emilly@biteti.com.br";

    let finalSubject: string;
    let finalBodyHtml: string;

    // If direct subject/body provided, use them; otherwise fetch from template
    if (directSubject && directBodyHtml) {
      finalSubject = directSubject;
      finalBodyHtml = directBodyHtml;
      console.log("Using direct subject/body content");
    } else {
      // Get template (default or specific)
      let template;
      if (templateId) {
        const { data } = await supabase
          .from("email_templates")
          .select("*")
          .eq("id", templateId)
          .single();
        template = data;
      } else {
        const { data } = await supabase
          .from("email_templates")
          .select("*")
          .eq("is_default", true)
          .single();
        template = data;
      }

      if (!template) {
        throw new Error("No email template found");
      }

      // Replace placeholders in template
      finalBodyHtml = template.body_html.replace(/\{\{name\}\}/g, leadName);
      finalSubject = template.subject.replace(/\{\{name\}\}/g, leadName);
      console.log("Using template:", template.name);
    }

    console.log("Sending email with subject:", finalSubject);

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [leadEmail],
      subject: finalSubject,
      html: finalBodyHtml,
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

    console.log("Email sent successfully:", emailResponse);

    // Record sent email in database
    const { error: insertError } = await supabase
      .from("sent_emails")
      .insert({
        lead_id: leadId,
        lead_name: leadName,
        lead_email: leadEmail,
        subject: finalSubject,
        body_html: finalBodyHtml,
        status: "sent",
        resend_id: resendId,
        sent_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Error recording sent email:", insertError);
    }

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);

    // Try to record failed email
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const body = await req.clone().json().catch(() => ({}));
      if (body.leadEmail) {
        await supabase
          .from("sent_emails")
          .insert({
            lead_id: body.leadId || null,
            lead_name: body.leadName || "Unknown",
            lead_email: body.leadEmail,
            subject: "Error",
            body_html: "",
            status: "failed",
            error_message: error.message,
          });
      }
    } catch (e) {
      console.error("Error recording failed email:", e);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
