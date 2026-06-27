import { supabase } from "@/integrations/supabase/client";

type WebhookTrigger = "lead_created" | "lead_moved" | "lead_updated" | "lead_deleted";

interface Lead {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  country_code?: string;
  instagram: string;
  service_area: string;
  monthly_billing: string;
  weekly_attendance: string;
  workspace_type: string;
  years_experience: string;
  pipeline_id: string | null;
  sub_origin_id: string | null;
  clinic_name?: string | null;
  average_ticket?: number | null;
  estimated_revenue?: number | null;
  is_mql?: boolean | null;
  created_at: string;
  // UTM fields
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  // Additional tracking
  biggest_difficulty?: string | null;
  can_afford?: string | null;
}

interface TriggerWebhookParams {
  trigger: WebhookTrigger;
  lead: Lead;
  pipeline_id?: string | null;
  previous_pipeline_id?: string | null;
  sub_origin_id?: string | null;
  origin_id?: string | null;
}

export async function triggerWebhook(params: TriggerWebhookParams): Promise<void> {
  try {
    console.log(`[Webhook] Triggering ${params.trigger} for lead ${params.lead.id}`);
    
    const { data, error } = await supabase.functions.invoke("trigger-webhook", {
      body: params,
    });

    if (error) {
      console.error("[Webhook] Error triggering webhook:", error);
      return;
    }

    console.log("[Webhook] Result:", data);
  } catch (error) {
    console.error("[Webhook] Error triggering webhook:", error);
    // Silently fail - don't block user operations
  }
}
