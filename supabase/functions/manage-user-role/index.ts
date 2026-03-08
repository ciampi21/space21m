import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MANAGE-USER-ROLE] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    // Verify admin user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const adminUser = userData.user;
    if (!adminUser?.email) throw new Error("User not authenticated");

    // Check if the current user is admin
    const { data: adminProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", adminUser.id)
      .single();

    if (profileError || adminProfile?.role !== 'admin') {
      throw new Error("Access denied. Admin privileges required.");
    }

    logStep("Admin user verified", { adminEmail: adminUser.email });

    const { user_id, new_role, reason } = await req.json();

    if (!user_id || !new_role) {
      throw new Error("Missing required fields: user_id and new_role");
    }

    if (!['admin', 'user'].includes(new_role)) {
      throw new Error("Invalid role. Must be 'admin' or 'user'");
    }

    logStep("Updating user role", { user_id, new_role });

    // Get current role for logging
    const { data: currentProfile, error: currentError } = await supabase
      .from("profiles")
      .select("role, email")
      .eq("user_id", user_id)
      .single();

    if (currentError) {
      throw new Error(`User not found: ${currentError.message}`);
    }

    const oldRole = currentProfile.role;
    const targetEmail = currentProfile.email;

    // Update the user's role using secure function
    const { data: updateResult, error: updateError } = await supabase
      .rpc("change_user_role_secure", {
        target_user_id: user_id,
        new_role: new_role,
        changed_by: adminUser.id,
        reason: reason || `Role changed by admin ${adminUser.email}`,
        ip_address: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown"
      });

    if (updateError) {
      throw new Error(`Failed to update role: ${updateError.message}`);
    }

    if (!updateResult) {
      throw new Error("Role update function returned false");
    }

    logStep("Role updated successfully using secure function", { targetEmail, oldRole, newRole: new_role });

    // Log administrative action for audit trail
    try {
      await supabase.rpc("log_admin_action", {
        action_type: "ROLE_CHANGE",
        target_resource: "user_profile",
        target_id: user_id,
        details: {
          old_role: oldRole,
          new_role: new_role,
          target_email: targetEmail,
          reason: reason || `Role changed by admin ${adminUser.email}`
        },
        ip_address: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown"
      });
    } catch (auditError) {
      // Log audit error but don't fail the operation
      logStep("WARNING: Failed to log audit action", { error: auditError });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Role updated from ${oldRole} to ${new_role}`,
      user_email: targetEmail
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in manage-user-role", { message: errorMessage }); // Edge function deployment fix
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});