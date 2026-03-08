import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PrepareInviteSetupRequest {
  token: string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = (await req.json()) as PrepareInviteSetupRequest;

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 1) Find invitation
    const { data: invite, error: inviteError } = await supabase
      .from("invitations")
      .select("id, email, workspace_id, expires_at, accepted_at")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: "Invitation not found or invalid." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Check expiration
    const now = new Date();
    const exp = new Date(invite.expires_at);
    if (exp < now) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invite.accepted_at) {
      // Already accepted — user might just need to sign in
      return new Response(
        JSON.stringify({ existing_user: true, message: "Invitation already accepted." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = String(invite.email).toLowerCase();

    // 3) Check if a profile already exists for this email
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, user_id, setup_token, setup_token_used_at, setup_token_expires_at")
      .eq("email", email)
      .maybeSingle();

    // Helper to create or refresh a setup token on an existing profile
    const ensureSetupTokenForProfile = async (user_id: string) => {
      const newToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ setup_token: newToken, setup_token_expires_at: expiresAt, setup_token_used_at: null })
        .eq("user_id", user_id);
      if (updateError) throw updateError;
      return newToken;
    };

    if (existingProfile && existingProfile.user_id) {
      // Check if user has completed setup (setup_token_used_at is not null)
      const hasCompletedSetup = existingProfile.setup_token_used_at !== null;
      
      if (hasCompletedSetup) {
        // User exists and has completed setup - should go to login
        return new Response(
          JSON.stringify({ existing_user: true, setup_complete: true, email }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // User exists but hasn't completed setup - ensure they have a valid setup token
      let tokenToUse = existingProfile.setup_token ?? null;
      const notUsed = !existingProfile.setup_token_used_at;
      const notExpired = existingProfile.setup_token_expires_at
        ? new Date(existingProfile.setup_token_expires_at) > new Date()
        : true;

      if (!tokenToUse || !notUsed || !notExpired) {
        tokenToUse = await ensureSetupTokenForProfile(existingProfile.user_id);
      }

      return new Response(
        JSON.stringify({ existing_user: true, setup_complete: false, setup_token: tokenToUse, email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Create auth user (no password yet) and a profile with setup token
    const { data: created, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { setup_pending: true },
    });

    if (createUserError || !created?.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user for invitation." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = created.user.id;
    const setupToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({
        user_id: userId,
        email,
        setup_token: setupToken,
        setup_token_expires_at: expiresAt,
      }, { onConflict: "user_id" });

    if (upsertError) {
      return new Response(
        JSON.stringify({ error: "Failed to prepare account setup." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ existing_user: false, setup_token: setupToken, email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("prepare-invite-setup unexpected error:", error); // Edge function deployment fix
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});