import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  subject: string;
  syncType: string;
  errorMessage: string;
  timestamp: string;
  itemCount?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { to, subject, syncType, errorMessage, timestamp, itemCount }: EmailRequest = await req.json();

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc2626; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .footer { background-color: #f3f4f6; padding: 15px; border-radius: 0 0 5px 5px; font-size: 12px; color: #6b7280; }
            .error-box { background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; color: #374151; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🚨 Sync Failure Alert</h1>
            </div>
            <div class="content">
              <p>A scheduled sync operation has failed and requires your attention.</p>

              <div class="info-row">
                <span class="label">Sync Type:</span> ${syncType}
              </div>
              <div class="info-row">
                <span class="label">Timestamp:</span> ${new Date(timestamp).toLocaleString()}
              </div>
              ${itemCount !== undefined ? `<div class="info-row"><span class="label">Items Before Failure:</span> ${itemCount}</div>` : ''}

              <div class="error-box">
                <strong>Error Details:</strong><br/>
                ${errorMessage}
              </div>

              <p><strong>Action Required:</strong></p>
              <ul>
                <li>Review the error message above</li>
                <li>Check SharePoint API connectivity and credentials</li>
                <li>Verify the sync function logs in Supabase dashboard</li>
                <li>No data was deleted - previous cache remains intact</li>
              </ul>
            </div>
            <div class="footer">
              <p>This is an automated notification from your Permitting System.</p>
              <p>System will retry on the next scheduled run (every 2 hours).</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured - logging email instead");
      console.log(`Would send email to ${to}: ${subject}`);
      console.log(`Error: ${errorMessage}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Email notification logged (RESEND_API_KEY not configured)",
          details: { to, subject, syncType, errorMessage }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Permitting System <noreply@ontivity.com>",
        to: [to],
        subject: subject,
        html: htmlBody,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Failed to send email via Resend: ${emailResponse.status} - ${errorText}`);
    }

    const emailData = await emailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email notification sent successfully",
        emailId: emailData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending email notification:", error);
    return new Response(
      JSON.stringify({
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
