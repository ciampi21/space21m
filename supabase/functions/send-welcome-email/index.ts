
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getErrorMessage } from "../_shared/error-utils.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Helper function to convert HTML to plain text
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
    .trim();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, customerName, trialDays = 15, setupToken, utmCampaign } = await req.json();
    
    if (!email) {
      throw new Error("Email is required");
    }

    if (!setupToken) {
      throw new Error("Setup token is required");
    }

    console.log("Sending welcome email to:", email);

    // Check if this is a 60-day trial user
    const is60DayTrial = utmCampaign === '60freetrial' || trialDays === 60;

    // Create the setup link - both flows now go through the app
    const setupUrl = trialDays ? 
      `https://app.21m.space/auth/setup-account?token=${setupToken}` :
      `https://app.21m.space/auth?token_hash=${setupToken}&type=signup`;

    console.log("Sending welcome email to:", email);
    console.log("Setup URL:", setupUrl);
    console.log("Is 60-day trial:", is60DayTrial);

    // Prepare email content based on trial type
    const emailSubject = is60DayTrial 
      ? "🎉 Welcome to 21M Space - 60 days PRO free!" 
      : trialDays 
      ? `🎉 Welcome to 21M Space - ${trialDays} days free trial!`
      : "🎉 Welcome to 21M Space - Confirm your account!";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">21M Space</h1>
          </div>
          
          <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Hello${customerName ? ', ' + customerName : ''}! 👋</h2>
            
            ${is60DayTrial ? `
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="color: white; font-size: 18px; font-weight: bold; margin: 0;">🚀 You got 60 days of PRO Plan for free!</p>
                <p style="color: white; margin: 10px 0 0 0;">Enjoy all premium features at no cost.</p>
              </div>
              <p>We're excited to have you on board! To start using your PRO account, click the button below to set up your password:</p>
            ` : trialDays ? `
              <p>Your account was created successfully! You have <strong>${trialDays} days of free trial</strong> to explore all platform features.</p>
              <p>To get started, click the button below to set up your password:</p>
            ` : `
              <p>Your account was created successfully! To start using the platform, confirm your email by clicking the button below:</p>
            `}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${setupUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold; 
                         display: inline-block;
                         box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                 ${trialDays ? 'Set Up My Account' : 'Confirm Email'}
               </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Or copy and paste this link into your browser:<br>
              <a href="${setupUrl}" style="color: #667eea; word-break: break-all;">${setupUrl}</a>
            </p>
            
            ${is60DayTrial ? `
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 30px;">
                <p style="margin: 0 0 10px 0; font-weight: bold;">✨ What you get with the PRO Plan:</p>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>Unlimited workspaces</li>
                  <li>Premium storage</li>
                  <li>All advanced features</li>
                  <li>Priority support</li>
                </ul>
              </div>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              If you didn't create this account, you can safely ignore this email.<br>
              © 2025 21M Space. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `;

    // Create plain text version
    const emailText = htmlToPlainText(emailHtml);

    const emailResponse = await resend.emails.send({
      from: "21M Space <support@21m.space>",
      to: [email],
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      headers: {
        'List-Unsubscribe': '<mailto:unsubscribe@21m.space>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      tags: [
        { name: 'category', value: 'transactional' },
        { name: 'type', value: 'welcome' },
        { name: 'environment', value: 'production' }
      ]
    });

    if (emailResponse.error) {
      console.error("Error sending email:", emailResponse.error);
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    console.log("Welcome email sent successfully:", emailResponse.data?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResponse.data?.id, 
        setupUrl: setupUrl
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in send-welcome-email function:", error); // Edge function deployment fix - rebuild
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
