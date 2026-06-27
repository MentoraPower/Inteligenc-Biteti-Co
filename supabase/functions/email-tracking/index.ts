import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Expected paths:
  // /email-tracking/open/{emailId}
  // /email-tracking/click/{emailId}?url={encodedUrl}
  
  const action = pathParts[1]; // "open" or "click"
  const emailId = pathParts[2];

  console.log(`[EmailTracking] Action: ${action}, EmailId: ${emailId}`);

  if (!emailId) {
    console.error("[EmailTracking] Missing emailId");
    return new Response("Missing email ID", { status: 400 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get request metadata
    const userAgent = req.headers.get("user-agent") || null;
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

    // Determine which table the email belongs to
    // First, check if it's from scheduled_emails
    const { data: scheduledEmail } = await supabase
      .from("scheduled_emails")
      .select("id")
      .eq("id", emailId)
      .maybeSingle();

    const isScheduledEmail = !!scheduledEmail;
    
    // If not scheduled, check sent_emails
    let isSentEmail = false;
    if (!isScheduledEmail) {
      const { data: sentEmail } = await supabase
        .from("sent_emails")
        .select("id")
        .eq("id", emailId)
        .maybeSingle();
      isSentEmail = !!sentEmail;
    }

    console.log(`[EmailTracking] Email source: ${isScheduledEmail ? 'scheduled_emails' : isSentEmail ? 'sent_emails' : 'unknown'}`);

    if (action === "open") {
      // Record open event (only first open per email)
      // Check for existing open event using the appropriate column
      let existingOpen = null;
      
      if (isScheduledEmail) {
        const { data } = await supabase
          .from("email_tracking_events")
          .select("id")
          .eq("scheduled_email_id", emailId)
          .eq("event_type", "open")
          .limit(1);
        existingOpen = data;
      } else if (isSentEmail) {
        const { data } = await supabase
          .from("email_tracking_events")
          .select("id")
          .eq("sent_email_id", emailId)
          .eq("event_type", "open")
          .limit(1);
        existingOpen = data;
      }

      if (!existingOpen || existingOpen.length === 0) {
        // Insert tracking event with the appropriate column
        const insertData: any = {
          event_type: "open",
          user_agent: userAgent,
          ip_address: ipAddress,
        };
        
        if (isScheduledEmail) {
          insertData.scheduled_email_id = emailId;
        } else if (isSentEmail) {
          insertData.sent_email_id = emailId;
        }
        
        await supabase.from("email_tracking_events").insert(insertData);
        console.log(`[EmailTracking] ✅ Recorded open for ${emailId} (${isScheduledEmail ? 'scheduled' : 'sent'})`);
      } else {
        console.log(`[EmailTracking] ⏭️ Open already recorded for ${emailId}`);
      }

      // Return tracking pixel
      return new Response(TRACKING_PIXEL, {
        status: 200,
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    } else if (action === "click") {
      const redirectUrl = url.searchParams.get("url");
      
      if (!redirectUrl) {
        console.error("[EmailTracking] Missing redirect URL");
        return new Response("Missing URL", { status: 400 });
      }

      // Record click event with the appropriate column
      const insertData: any = {
        event_type: "click",
        link_url: redirectUrl,
        user_agent: userAgent,
        ip_address: ipAddress,
      };
      
      if (isScheduledEmail) {
        insertData.scheduled_email_id = emailId;
      } else if (isSentEmail) {
        insertData.sent_email_id = emailId;
      }
      
      await supabase.from("email_tracking_events").insert(insertData);
      console.log(`[EmailTracking] ✅ Recorded click for ${emailId} -> ${redirectUrl}`);

      // Redirect to the actual URL
      return new Response(null, {
        status: 302,
        headers: {
          "Location": redirectUrl,
        },
      });
    } else {
      return new Response("Invalid action", { status: 400 });
    }
  } catch (error: any) {
    console.error("[EmailTracking] Error:", error);
    
    // For open events, still return the pixel even if tracking fails
    if (action === "open") {
      return new Response(TRACKING_PIXEL, {
        status: 200,
        headers: { "Content-Type": "image/gif" },
      });
    }
    
    // For click events, try to redirect anyway
    const redirectUrl = url.searchParams.get("url");
    if (redirectUrl) {
      return new Response(null, {
        status: 302,
        headers: { "Location": redirectUrl },
      });
    }
    
    return new Response("Error", { status: 500 });
  }
};

serve(handler);
