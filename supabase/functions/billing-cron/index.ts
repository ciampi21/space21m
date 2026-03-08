import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BILLING-CRON] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Billing cron job started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const now = new Date();

    // Buscar usuários com grace_until vencido
    const { data: expiredUsers, error: queryError } = await supabase
      .from("profiles")
      .select("user_id, email, current_subscription_id, stripe_customer_id")
      .eq("subscription_status", "past_due")
      .not("grace_until", "is", null)
      .lt("grace_until", now.toISOString());

    if (queryError) {
      logStep("Error querying expired users", { error: queryError });
      throw queryError;
    }

    logStep("Found expired users", { count: expiredUsers?.length || 0 });

    if (expiredUsers && expiredUsers.length > 0) {
      for (const user of expiredUsers) {
        try {
          logStep("Processing expired user", { email: user.email });

          // Cancelar assinatura no Stripe se ainda ativa
          if (user.current_subscription_id) {
            try {
              await stripe.subscriptions.update(user.current_subscription_id, {
                cancel_at_period_end: true
              });
              logStep("Stripe subscription marked for cancellation", { 
                subscriptionId: user.current_subscription_id 
              });
            } catch (stripeError) {
              logStep("Error canceling Stripe subscription", { 
                error: stripeError,
                subscriptionId: user.current_subscription_id 
              });
            }
          }

          // Downgrade para free e limpar dados
          const { error: downgradeError } = await supabase
            .from("profiles")
            .update({
              plan_tier: 'free',
              is_early_adopter: false,
              subscription_status: 'canceled',
              subscription_active: false,
              current_price_id: null,
              current_subscription_id: null,
              past_due_since: null,
              grace_until: null,
              billing_banner: null
            })
            .eq("user_id", user.user_id);

          if (downgradeError) {
            logStep("Error downgrading user", { error: downgradeError, email: user.email });
            continue;
          }

          // Forçar autodelete_days=90 em todos os workspaces do usuário
          const { error: workspaceError } = await supabase
            .from("workspaces")
            .update({ autodelete_days: 90 })
            .eq("owner_id", user.user_id);

          if (workspaceError) {
            logStep("Error updating workspace autodelete", { error: workspaceError, email: user.email });
          }

          // Deletar workspaces e posts do usuário (cascade irá cuidar dos posts)
          const { error: deleteError } = await supabase
            .from("workspaces")
            .delete()
            .eq("owner_id", user.user_id);

          if (deleteError) {
            logStep("Error deleting workspaces", { error: deleteError, email: user.email });
          } else {
            logStep("Successfully processed expired user", { email: user.email });
          }

          // Enviar email de downgrade
          try {
            await supabase.functions.invoke("send-downgrade-email", {
              body: {
                email: user.email
              }
            });
            logStep("Downgrade email sent", { email: user.email });
          } catch (emailError) {
            logStep("Error sending downgrade email", { error: emailError, email: user.email });
          }

        } catch (userError) {
          logStep("Error processing user", { error: userError, email: user.email });
        }
      }
    }

    // PROCESS EXPIRED TRIALS
    logStep("Checking expired trials");

    const { data: expiredTrials, error: trialError } = await supabase
      .from("profiles")
      .select("user_id, email, trial_ends_at")
      .eq("subscription_status", "trialing")
      .not("trial_ends_at", "is", null)
      .lt("trial_ends_at", now.toISOString());

    if (!trialError && expiredTrials && expiredTrials.length > 0) {
      logStep("Found expired trials", { count: expiredTrials.length });
      
      for (const user of expiredTrials) {
        try {
          // Downgrade to free
          await supabase
            .from("profiles")
            .update({
              plan_tier: 'free',
              subscription_status: 'inactive',
              trial_ends_at: null,
              billing_banner: 'Your trial has expired. Upgrade to continue with premium benefits.'
            })
            .eq("user_id", user.user_id);

          logStep("Trial expired - downgraded to free", { email: user.email });
          
        } catch (userError) {
          logStep("Error processing trial", { error: userError, email: user.email });
        }
      }
    }

    logStep("Billing cron job completed successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      processedUsers: expiredUsers?.length || 0,
      expiredTrials: expiredTrials?.length || 0
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("CRITICAL ERROR in billing-cron", { message: errorMessage }); // Edge function deployment fix - rebuild v3
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});