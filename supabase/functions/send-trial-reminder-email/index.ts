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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, username, daysRemaining, language = 'en' } = await req.json();

    const messages = {
      en: {
        subject: `⏰ Your 60-day trial ends in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}!`,
        body: `
          <h2>Hello ${username}!</h2>
          <p>Your 60-day free trial of <strong>21M Space PRO</strong> is ending in <strong>${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}</strong>.</p>
          
          <h3>🎁 Exclusive Early Adopter Offer</h3>
          <p><strong>Double the limits at half the price: US$ 11.99/month!</strong></p>
          <ul>
            <li>🚀 2 GB storage (vs 1 GB normal)</li>
            <li>🚀 6 workspaces (vs 3 normal)</li>
            <li>💰 50% off forever while you maintain subscription</li>
            <li>⚡ Limited to first 100 users</li>
          </ul>
          
          <p style="margin: 30px 0; text-align: center;">
            <a href="https://21m.space/early-adopters/" 
               style="background-color: #8B5CF6; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              🎯 Claim Early Adopter Offer
            </a>
          </p>
          
          <p style="color: #666;"><small>If you don't subscribe, your plan will convert to Free after ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}.</small></p>
        `
      },
      pt: {
        subject: `⏰ Seu trial de 60 dias acaba em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}!`,
        body: `
          <h2>Olá ${username}!</h2>
          <p>Seu trial gratuito de 60 dias do <strong>21M Space PRO</strong> está acabando em <strong>${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}</strong>.</p>
          
          <h3>🎁 Oferta Exclusiva Early Adopter</h3>
          <p><strong>Dobro de limites pela metade do preço: US$ 11,99/mês!</strong></p>
          <ul>
            <li>🚀 2 GB de armazenamento (vs 1 GB normal)</li>
            <li>🚀 6 workspaces (vs 3 normal)</li>
            <li>💰 50% de desconto para sempre enquanto mantiver assinatura</li>
            <li>⚡ Limitado aos primeiros 100 usuários</li>
          </ul>
          
          <p style="margin: 30px 0; text-align: center;">
            <a href="https://21m.space/early-adopters/" 
               style="background-color: #8B5CF6; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              🎯 Garantir Oferta Early Adopter
            </a>
          </p>
          
          <p style="color: #666;"><small>Se você não assinar, seu plano será convertido para Free após ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}.</small></p>
        `
      }
    };

    const content = messages[language as keyof typeof messages] || messages.en;

    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            h2 { color: #8B5CF6; }
            ul { padding-left: 20px; }
            li { margin: 8px 0; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #8B5CF6;">21M Space</h1>
          </div>
          ${content.body}
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Need help? Reply to this email or visit <a href="https://app.21m.space">app.21m.space</a>
          </p>
        </body>
        </html>
      `;

    const emailText = htmlToPlainText(emailHtml);

    const { error } = await resend.emails.send({
      from: "21M Space <no-reply@21m.space>",
      to: [email],
      subject: content.subject,
      html: emailHtml,
      text: emailText,
      headers: {
        'List-Unsubscribe': '<mailto:unsubscribe@21m.space>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      tags: [
        { name: 'category', value: 'transactional' },
        { name: 'type', value: 'trial_reminder' },
        { name: 'environment', value: 'production' }
      ]
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
    
  } catch (error: any) {
    console.error("Error sending trial reminder:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
