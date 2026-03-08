import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to convert HTML to plain text
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

interface SupportNotificationRequest {
  ticketId: string;
  subject: string;
  message: string;
  category: string;
  userEmail: string;
  userName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      ticketId, 
      subject, 
      message, 
      category, 
      userEmail, 
      userName 
    }: SupportNotificationRequest = await req.json();

    console.log('Sending support notification email for ticket:', ticketId);

    // Format category for display
    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

    console.log('Sending support notification email for ticket:', ticketId);

    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Support Ticket</h2>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Ticket ID:</strong> ${ticketId}</p>
            <p><strong>Category:</strong> ${categoryLabel}</p>
            <p><strong>User:</strong> ${userName}</p>
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Subject:</strong> ${subject}</p>
          </div>
          
          <div style="background-color: #fff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #555;">Message:</h3>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated email from 21M Space system.
          </p>
        </div>
      `;

    const emailText = htmlToPlainText(emailHtml);

    // Send email to support team
    const emailResponse = await resend.emails.send({
      from: "21M Space Support <support@21m.space>",
      to: ["support@21m.space"],
      subject: `[Support ${categoryLabel}] ${subject}`,
      html: emailHtml,
      text: emailText,
      headers: {
        'X-Entity-Ref-ID': `ticket-${ticketId}`,
      },
      tags: [
        { name: 'category', value: 'support' },
        { name: 'type', value: 'notification' },
        { name: 'environment', value: 'production' }
      ]
    });

    console.log("Support notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify({
      success: true,
      message: "Support notification sent successfully",
      emailId: emailResponse.id
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-support-notification function:", error);
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