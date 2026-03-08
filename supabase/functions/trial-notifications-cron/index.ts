import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const logStep = (step: string, details?: any) => {
  console.log(`[TRIAL-NOTIF] ${step}`, details || '');
};

serve(async (req) => {
  try {
    logStep("Starting trial notifications cron");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const now = new Date();
    
    // Fetch users in trial
    const { data: trialUsers, error: queryError } = await supabase
      .from("profiles")
      .select("user_id, email, username, trial_ends_at, language")
      .eq("subscription_status", "trialing")
      .not("trial_ends_at", "is", null)
      .gte("trial_ends_at", now.toISOString())
      .order("trial_ends_at", { ascending: true });

    if (queryError) throw queryError;

    logStep("Found trial users", { count: trialUsers?.length || 0 });

    if (!trialUsers || trialUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No trial users" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    let notificationsSent = 0;

    for (const user of trialUsers) {
      const trialEndsAt = new Date(user.trial_ends_at);
      const daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let notificationType: string | null = null;
      
      if (daysRemaining === 7) notificationType = "d7";
      else if (daysRemaining === 3) notificationType = "d3";
      else if (daysRemaining === 1) notificationType = "d1";

      if (!notificationType) continue;

      // Check if notification already sent
      const { data: existingNotif } = await supabase
        .from("trial_notifications")
        .select("id")
        .eq("user_id", user.user_id)
        .eq("notification_type", `email_${notificationType}`)
        .single();

      if (existingNotif) {
        logStep("Already sent", { email: user.email, type: notificationType });
        continue;
      }

      // Send email
      try {
        await supabase.functions.invoke("send-trial-reminder-email", {
          body: {
            email: user.email,
            username: user.username || user.email.split('@')[0],
            daysRemaining,
            trialEndsAt: trialEndsAt.toISOString(),
            language: user.language || 'en'
          }
        });

        logStep("Email sent", { email: user.email, daysRemaining });
      } catch (emailError) {
        logStep("Email error", { error: emailError, email: user.email });
      }

      // Register notification
      await supabase.from("trial_notifications").insert([
        {
          user_id: user.user_id,
          notification_type: `email_${notificationType}`,
          trial_ends_at: trialEndsAt.toISOString()
        },
        {
          user_id: user.user_id,
          notification_type: `app_${notificationType}`,
          trial_ends_at: trialEndsAt.toISOString()
        }
      ]);

      notificationsSent++;
    }

    logStep("Completed", { notificationsSent });

    return new Response(JSON.stringify({ success: true, notificationsSent }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logStep("ERROR", { error: error instanceof Error ? error.message : String(error) });
    
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
