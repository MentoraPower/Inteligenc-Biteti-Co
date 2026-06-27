import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface WebhookPayload {
  trigger: "lead_created" | "lead_moved" | "lead_updated" | "lead_deleted";
  lead: {
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
  };
  pipeline_id?: string | null;
  previous_pipeline_id?: string | null;
  sub_origin_id?: string | null;
  origin_id?: string | null;
}

interface EmailAutomation {
  id: string;
  name: string;
  trigger_pipeline_id: string;
  sub_origin_id: string | null;
  subject: string;
  body_html: string;
  is_active: boolean;
  flow_steps: any[] | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    
    console.log("Trigger webhook received:", JSON.stringify(payload).substring(0, 500));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===== WEBHOOKS PROCESSING =====
    const { data: webhooks, error: webhooksError } = await supabase
      .from("crm_webhooks")
      .select("*")
      .eq("type", "send")
      .eq("is_active", true);

    if (webhooksError) {
      console.error("Error fetching webhooks:", webhooksError);
    }

    const triggeredWebhooks: string[] = [];

    if (webhooks && webhooks.length > 0) {
      console.log(`Found ${webhooks.length} active send webhooks`);

      for (const webhook of webhooks) {
        let shouldTrigger = false;

        // Check if trigger matches
        if (webhook.trigger === payload.trigger) {
          // For "lead_moved" trigger, also check specific pipeline
          if (webhook.trigger === "lead_moved") {
            if (webhook.trigger_pipeline_id) {
              // Check if lead was moved TO this specific pipeline
              shouldTrigger = payload.pipeline_id === webhook.trigger_pipeline_id;
            } else {
              // No specific pipeline, trigger on any move
              shouldTrigger = true;
            }
          } else {
            shouldTrigger = true;
          }
        }

        // Check scope filtering
        if (shouldTrigger && webhook.scope !== "all") {
          if (webhook.scope === "origin" && webhook.origin_id) {
            // Need to check if the lead's sub_origin belongs to this origin
            if (payload.sub_origin_id) {
              const { data: subOrigin } = await supabase
                .from("crm_sub_origins")
                .select("origin_id")
                .eq("id", payload.sub_origin_id)
                .single();
              
              shouldTrigger = subOrigin?.origin_id === webhook.origin_id;
            } else {
              shouldTrigger = false;
            }
          } else if (webhook.scope === "sub_origin" && webhook.sub_origin_id) {
            shouldTrigger = payload.sub_origin_id === webhook.sub_origin_id;
          }
        }

        if (shouldTrigger && webhook.url) {
          console.log(`Triggering webhook "${webhook.name}" to ${webhook.url}`);
          
          try {
            const lead = payload.lead;
            
            const webhookPayload = {
              evento: payload.trigger,
              data_envio: new Date().toISOString(),
              dados: {
                id: lead.id,
                nome: lead.name,
                email: lead.email,
                whatsapp: lead.whatsapp,
                codigo_pais: lead.country_code,
                instagram: lead.instagram,
                nome_clinica: lead.clinic_name || null,
                area_atuacao: lead.service_area,
                faturamento_mensal: lead.monthly_billing,
                atendimentos_semana: lead.weekly_attendance,
                ticket_medio: lead.average_ticket || null,
                tipo_espaco: lead.workspace_type,
                anos_experiencia: lead.years_experience,
                receita_estimada: lead.estimated_revenue || null,
                e_mql: lead.is_mql || null,
                maior_dificuldade: lead.biggest_difficulty || null,
                pode_investir: lead.can_afford || null,
                data_cadastro: lead.created_at,
              },
              utm: {
                source: lead.utm_source || null,
                medium: lead.utm_medium || null,
                campaign: lead.utm_campaign || null,
                term: lead.utm_term || null,
                content: lead.utm_content || null,
              },
              pipeline: {
                atual: payload.pipeline_id,
                anterior: payload.previous_pipeline_id || null,
              },
              origem: {
                sub_origin_id: payload.sub_origin_id,
                origin_id: payload.origin_id || null,
              },
            };

            const response = await fetch(webhook.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(webhookPayload),
            });

            if (response.ok) {
              console.log(`Webhook "${webhook.name}" triggered successfully`);
              triggeredWebhooks.push(webhook.name);
            } else {
              console.error(`Webhook "${webhook.name}" failed with status ${response.status}`);
            }
          } catch (fetchError) {
            console.error(`Error calling webhook "${webhook.name}":`, fetchError);
          }
        }
      }
    }

    // ===== EMAIL AUTOMATIONS PROCESSING =====
    const triggeredEmails: string[] = [];

    const effectivePipelineId = payload.pipeline_id ?? payload.lead?.pipeline_id ?? null;
    const effectiveSubOriginId = payload.sub_origin_id ?? payload.lead?.sub_origin_id ?? null;

    if ((payload.trigger === "lead_moved" || payload.trigger === "lead_created") && effectivePipelineId) {
      console.log(`[EmailAutomation] ${payload.trigger}`, {
        pipeline_id: effectivePipelineId,
        sub_origin_id: effectiveSubOriginId,
        lead_id: payload.lead?.id,
        lead_email: payload.lead?.email,
      });

      const { data: allEmailAutomations, error: emailError } = await supabase
        .from("email_automations")
        .select("*")
        .eq("is_active", true);

      if (emailError) {
        console.error("[EmailAutomation] Error fetching email automations:", emailError);
      }

      const emailAutomations = (allEmailAutomations ?? []).filter((automation: any) => {
        // Backward compatibility
        if (automation.trigger_pipeline_id === effectivePipelineId) return true;

        const flowSteps = automation.flow_steps as any[] | null;
        if (!flowSteps || !Array.isArray(flowSteps)) return false;

        const triggerNode = flowSteps.find((step) => step?.type === "trigger");
        const triggers = triggerNode?.data?.triggers;
        if (!triggers || !Array.isArray(triggers)) return false;

        return triggers.some((t: any) => t?.pipelineId === effectivePipelineId);
      });

      if (emailAutomations.length > 0) {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");

        if (!resendApiKey) {
          console.error("[EmailAutomation] RESEND_API_KEY not configured");
        } else {
          const resend = new Resend(resendApiKey);

          for (const automation of emailAutomations as EmailAutomation[]) {
            // Check sub_origin scope if specified
            if (automation.sub_origin_id && automation.sub_origin_id !== effectiveSubOriginId) {
              continue;
            }

            // Check if lead has email
            if (!payload.lead?.email) {
              continue;
            }

            try {
              const leadName = payload.lead.name || "Cliente";
              const replaceName = (value: string) =>
                value
                  .replace(/\{\{name\}\}/g, leadName)
                  .replace(/\{\{nome\}\}/g, leadName)
                  .replace(/\{name\}/g, leadName)
                  .replace(/\{nome\}/g, leadName);

              // Find the correct email node by tracing edges from the matched trigger
              let subject = automation.subject;
              let bodyHtml = automation.body_html;
              const flowSteps = automation.flow_steps as any[] | null;
              
              if (flowSteps && Array.isArray(flowSteps)) {
                // Get edges from _edges step
                const edgesStep = flowSteps.find((step) => step?.type === "_edges");
                const edges = edgesStep?.data?.edges as any[] | null;
                
                // Find trigger node and determine which trigger index matched
                const triggerNode = flowSteps.find((step) => step?.type === "trigger");
                const triggers = triggerNode?.data?.triggers as any[] | null;
                
                let targetEmailNodeId: string | null = null;
                
                if (triggers && edges && triggerNode) {
                  // Find which trigger matched and its index
                  const matchedTriggerIndex = triggers.findIndex((t: any) => t?.pipelineId === effectivePipelineId);
                  console.log(`[EmailAutomation] Matched trigger index: ${matchedTriggerIndex}, pipeline: ${effectivePipelineId}`);
                  
                  if (matchedTriggerIndex >= 0) {
                    // Determine the sourceHandle for this trigger index
                    const expectedHandle = `trigger-handle-${matchedTriggerIndex}`;
                    
                    // Find edge from trigger node with matching sourceHandle
                    const startingEdge = edges.find((edge: any) => {
                      if (edge.source !== triggerNode.id) return false;
                      if (edge.sourceHandle === expectedHandle) return true;
                      if (matchedTriggerIndex === 0 && (!edge.sourceHandle || edge.sourceHandle === null)) {
                        return true;
                      }
                      return false;
                    });
                    
                    if (startingEdge) {
                      // Follow the path of edges to find the email node
                      // This handles cases like: trigger → wait → email
                      let currentNodeId = startingEdge.target;
                      const visitedNodes = new Set<string>();
                      const maxIterations = 20; // Safety limit
                      let iterations = 0;
                      
                      // Collect all action nodes in the path (email, etc.)
                      const actionNodes: { id: string; type: string; node: any }[] = [];
                      
                      while (currentNodeId && iterations < maxIterations) {
                        iterations++;
                        
                        // Avoid infinite loops
                        if (visitedNodes.has(currentNodeId)) {
                          console.log(`[Automation] Detected cycle at node: ${currentNodeId}`);
                          break;
                        }
                        visitedNodes.add(currentNodeId);
                        
                        // Find the current node
                        const currentNode = flowSteps.find((step) => step?.id === currentNodeId);
                        
                        if (!currentNode) {
                          console.log(`[Automation] Node not found: ${currentNodeId}`);
                          break;
                        }
                        
                        console.log(`[Automation] Visiting node: ${currentNodeId}, type: ${currentNode.type}`);
                        
                        // If it's an email node, add to action nodes
                        if (currentNode.type === "email") {
                          actionNodes.push({ id: currentNodeId, type: "email", node: currentNode });
                          console.log(`[Automation] Found email node: ${currentNodeId}`);
                        }
                        
                        // If it's an end node, stop the chain
                        if (currentNode.type === "end") {
                          console.log(`[Automation] Reached end node`);
                          break;
                        }
                        
                        // Find the next edge from this node (for wait nodes, etc.)
                        const nextEdge = edges.find((edge: any) => edge.source === currentNodeId);
                        
                        if (nextEdge) {
                          currentNodeId = nextEdge.target;
                        } else {
                          console.log(`[Automation] No outgoing edge from node: ${currentNodeId}`);
                          break;
                        }
                      }
                      
                      // Process all action nodes found in the path
                      for (const actionNode of actionNodes) {
                        if (actionNode.type === "email") {
                          targetEmailNodeId = actionNode.id;
                        }
                      }
                    } else {
                      console.log(`[Automation] No matching edge found for handle: ${expectedHandle}`);
                      continue;
                    }
                  }
                }
                
                // Only send email if there's a valid connected email node
                if (!targetEmailNodeId) {
                  console.log(`[Automation] No email node in path for automation "${automation.name}" - skipping`);
                  continue;
                }
                
                // Find the target email node
                let emailNode = flowSteps.find((step) => step?.id === targetEmailNodeId && step?.type === "email");
                
                if (!emailNode?.data) {
                  console.log(`[Automation] Email node "${targetEmailNodeId}" has no data - skipping email`);
                  continue;
                }
                
                subject = emailNode.data.subject || subject;
                bodyHtml = emailNode.data.bodyHtml || bodyHtml;
                console.log(`[Automation] Using email node: ${emailNode.id}`);
              }

              subject = replaceName(subject);
              bodyHtml = replaceName(bodyHtml);

              // Get email settings for from address
              const { data: settings } = await supabase
                .from("email_settings")
                .select("*")
                .limit(1)
                .single();

              const fromName = settings?.from_name || "Mentora Beauty Academy";
              const fromEmail = settings?.from_email || "contato@mentorabeautyacademy.com.br";

              const emailResponse = await resend.emails.send({
                from: `${fromName} <${fromEmail}>`,
                to: [payload.lead.email],
                subject,
                html: bodyHtml,
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

              console.log(`[EmailAutomation] Sent "${automation.name}"`, {
                lead_id: payload.lead.id,
                to: payload.lead.email,
                resend_id: resendId,
              });

              triggeredEmails.push(automation.name);

              // Record sent email in database (best-effort)
              const { error: insertError } = await supabase.from("sent_emails").insert({
                lead_id: payload.lead.id,
                lead_name: payload.lead.name,
                lead_email: payload.lead.email,
                subject,
                body_html: bodyHtml,
                status: "sent",
                resend_id: resendId,
                sent_at: new Date().toISOString(),
              });

              if (insertError) {
                console.error("[EmailAutomation] Error inserting sent_emails:", insertError);
              }
            } catch (emailError: any) {
              console.error(`[EmailAutomation] Failed "${automation.name}"`, emailError);

              const { error: insertError } = await supabase.from("sent_emails").insert({
                lead_id: payload.lead?.id,
                lead_name: payload.lead?.name,
                lead_email: payload.lead?.email,
                subject: automation.subject,
                body_html: automation.body_html,
                status: "failed",
                error_message: emailError?.message,
              });

              if (insertError) {
                console.error("[EmailAutomation] Error inserting failed sent_emails:", insertError);
              }
            }
          }
        }
      } else {
        console.log("[EmailAutomation] No active automations for pipeline:", effectivePipelineId);
      }
    }


    console.log(`Triggered ${triggeredWebhooks.length} webhooks:`, triggeredWebhooks);
    console.log(`Triggered ${triggeredEmails.length} emails:`, triggeredEmails);

    return new Response(
      JSON.stringify({ 
        success: true, 
        triggered_webhooks: triggeredWebhooks.length,
        webhooks: triggeredWebhooks,
        triggered_emails: triggeredEmails.length,
        emails: triggeredEmails
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in trigger-webhook function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
