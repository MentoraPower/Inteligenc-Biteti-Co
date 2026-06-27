import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MQL criteria: estimated revenue * 0.55 >= R$ 2,800
const SERVICE_COST = 2800;
const MIN_REVENUE_RATIO = 0.55;

// Check if lead has required fields for MQL calculation
const hasRequiredFields = (lead: {
  weekly_attendance: string | null;
  average_ticket: number | null;
  service_area: string | null;
  monthly_billing: string | null;
}): boolean => {
  // Must have at least weekly_attendance AND average_ticket to calculate MQL
  const hasWeeklyAttendance = !!(lead.weekly_attendance && lead.weekly_attendance.trim() !== '');
  const hasAverageTicket = lead.average_ticket !== null && lead.average_ticket > 0;
  
  return hasWeeklyAttendance && hasAverageTicket;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all leads - recalculate everything to fix bad data
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('id, weekly_attendance, average_ticket, service_area, monthly_billing, estimated_revenue, is_mql');

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${leads?.length || 0} leads to process`);

    let updated = 0;
    let errors = 0;
    let markedMQL = 0;
    let markedNotMQL = 0;
    let clearedIncomplete = 0;

    for (const lead of leads || []) {
      try {
        // Check if lead has required fields
        if (!hasRequiredFields(lead)) {
          // Lead is incomplete - cannot be MQL, clear any bad data
          if (lead.is_mql === true || lead.estimated_revenue !== null) {
            const { error: updateError } = await supabase
              .from('leads')
              .update({
                is_mql: null, // null = not calculated yet (incomplete lead)
                estimated_revenue: null,
                analysis_created_at: null
              })
              .eq('id', lead.id);

            if (updateError) {
              console.error(`Error clearing lead ${lead.id}:`, updateError);
              errors++;
            } else {
              clearedIncomplete++;
              updated++;
            }
          }
          continue;
        }

        // Calculate estimated revenue from actual form data
        const appointments = parseInt(lead.weekly_attendance!) || 0;
        const ticket = parseFloat(String(lead.average_ticket)) || 0;
        const estimatedRevenue = appointments * 4 * ticket;

        // Calculate MQL status
        // MQL = true if estimated revenue allows service to be <= 55% of revenue
        const isMQL = estimatedRevenue > 0 && (estimatedRevenue * MIN_REVENUE_RATIO) >= SERVICE_COST;

        // Update the lead
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            is_mql: isMQL,
            estimated_revenue: estimatedRevenue > 0 ? estimatedRevenue : null,
            analysis_created_at: new Date().toISOString()
          })
          .eq('id', lead.id);

        if (updateError) {
          console.error(`Error updating lead ${lead.id}:`, updateError);
          errors++;
        } else {
          updated++;
          if (isMQL) markedMQL++;
          else markedNotMQL++;
        }
      } catch (e) {
        console.error(`Error processing lead ${lead.id}:`, e);
        errors++;
      }
    }

    console.log(`Results: ${updated} updated, ${markedMQL} MQL, ${markedNotMQL} not MQL, ${clearedIncomplete} cleared (incomplete), ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      processed: leads?.length || 0,
      updated,
      markedMQL,
      markedNotMQL,
      clearedIncomplete,
      errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in recalculate-mql:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
