import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanupRequest {
  email?: string;
  user_id?: string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, user_id }: CleanupRequest = await req.json();
    if (!email && !user_id) {
      return new Response(
        JSON.stringify({ error: "Provide email or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Resolve profile
    const profileQuery = supabase
      .from("profiles")
      .select("id, user_id, email, username, setup_token, setup_token_used_at")
      .limit(1);

    const { data: profiles, error: profileErr } = email
      ? await profileQuery.eq("email", email)
      : await profileQuery.eq("user_id", user_id!);

    if (profileErr) {
      console.error("Profile lookup error:", profileErr);
      return new Response(
        JSON.stringify({ error: "Failed to lookup profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profile = profiles?.[0];
    if (!profile) {
      return new Response(
        JSON.stringify({ success: true, message: "No profile found; nothing to clean" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only delete accounts that never completed setup (no username OR setup token not used)
    const isPending = (!profile.username || !profile.setup_token_used_at);

    if (!isPending) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Account is active (not pending)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure user has no memberships
    const { data: memberships, error: memberErr } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", profile.user_id);

    if (memberErr) {
      console.error("Memberships lookup error:", memberErr);
      return new Response(
        JSON.stringify({ error: "Failed to check memberships" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if ((memberships?.length ?? 0) > 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "User still has workspace memberships" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete profile first
    const { error: delProfErr } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", profile.user_id);

    if (delProfErr) {
      console.error("Failed to delete profile:", delProfErr);
      return new Response(
        JSON.stringify({ error: "Failed to delete profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete auth user
    const { error: delUserErr } = await supabase.auth.admin.deleteUser(profile.user_id);
    if (delUserErr) {
      console.error("Failed to delete auth user:", delUserErr);
      // Profile is gone already; return partial success
      return new Response(
        JSON.stringify({ success: true, warning: "Profile deleted but failed to delete auth user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, deleted: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("cleanup-pending-account unexpected error:", error); // Edge function deployment fix - rebuild v2
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
