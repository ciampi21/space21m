import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptInvitationRequest {
  token: string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== ACCEPT INVITATION START ===");
    console.log("Request method:", req.method);
    console.log("Request URL:", req.url);
    console.log("Timestamp:", new Date().toISOString());
    
    const authHeader = req.headers.get("Authorization");
    console.log("Authorization header present:", !!authHeader);
    
    // Log request headers for debugging (without exposing sensitive data)
    const headers: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      if (key.toLowerCase() === 'authorization') {
        headers[key] = value ? `Bearer ${value.slice(7, 15)}...` : 'missing';
      } else {
        headers[key] = value;
      }
    }
    console.log("Request headers:", headers);
    
    if (!authHeader) {
      console.log("No auth header provided");
      return new Response(
        JSON.stringify({ error: "Not authenticated. Please sign in to accept the invitation." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: AcceptInvitationRequest;
    try {
      body = await req.json();
      console.log("Request body parsed:", { token: body?.token ? "***" : "missing" });
    } catch (error) {
      console.error("JSON parsing error:", error);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token } = body || {} as any;
    if (!token || typeof token !== "string") {
      console.log("Missing or invalid token");
      return new Response(
        JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for DB operations while verifying the user with the JWT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { 
        auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        } 
      }
    );

    console.log("Extracting JWT from auth header");
    const jwt = authHeader.replace("Bearer ", "");
    console.log("JWT extracted, length:", jwt.length);
    
    // Parse JWT to check expiration and basic structure
    try {
      const jwtParts = jwt.split('.');
      if (jwtParts.length !== 3) {
        console.error("Invalid JWT format: JWT should have 3 parts, has", jwtParts.length);
        return new Response(
          JSON.stringify({ error: "Invalid JWT format. Please sign in again." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const payload = JSON.parse(atob(jwtParts[1]));
      console.log("JWT payload info:", { 
        sub: payload.sub,
        exp: payload.exp,
        iat: payload.iat,
        email: payload.email,
        currentTime: Math.floor(Date.now() / 1000)
      });
      
      // Check if JWT is expired
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        console.error("JWT is expired:", {
          expiration: payload.exp,
          currentTime: Math.floor(Date.now() / 1000)
        });
        return new Response(
          JSON.stringify({ error: "Session expired. Please sign in again." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (jwtParseError) {
      console.error("Error parsing JWT:", jwtParseError);
      return new Response(
        JSON.stringify({ error: "Invalid JWT token. Please sign in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Getting user from JWT");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error("User validation error:", userError);
      console.error("Full error details:", { 
        message: userError?.message, 
        status: userError?.status, 
        code: userError?.code 
      });
      
      // For user_not_found errors, provide clearer guidance
      if (userError?.code === 'user_not_found') {
        console.error("User not found - JWT may reference deleted user");
        return new Response(
          JSON.stringify({ 
            error: "User session is invalid. Your account may have been recreated. Please sign out and sign in again.",
            errorCode: "user_not_found",
            needsReauth: true
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Unauthorized. Please sign in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Authenticated user:", { id: user.id, email: user.email });

    // Check if user has a profile (critical for proper functioning)
    console.log("Checking if user has a profile in profiles table");
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, email, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Error checking user profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Error validating user profile. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userProfile) {
      console.log("User does not have a profile, creating one automatically");
      // Try to create profile if it doesn't exist
      const { data: newProfile, error: createProfileError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          email: user.email,
          role: 'user'
        })
        .select()
        .single();

      if (createProfileError) {
        console.error("Error creating user profile:", createProfileError);
        
        // Check if it's a duplicate profile error
        if (createProfileError.code === '23505') {
          console.log("Profile already exists, attempting to fetch it again");
          const { data: existingProfile, error: refetchError } = await supabase
            .from("profiles")
            .select("id, user_id, email, role")
            .eq("user_id", user.id)
            .maybeSingle();
            
          if (refetchError || !existingProfile) {
            console.error("Failed to refetch existing profile:", refetchError);
            return new Response(
              JSON.stringify({ error: "User profile is in an inconsistent state. Please contact support." }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          console.log("Found existing profile:", existingProfile);
        } else {
          return new Response(
            JSON.stringify({ error: "Unable to create user profile. Please contact support." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        console.log("Created new profile:", newProfile);
      }
    } else {
      console.log("User profile found:", { id: userProfile.id, email: userProfile.email, role: userProfile.role });
    }

    // Find invitation by token
    console.log("Looking up invitation with token");
    const { data: invite, error: inviteError } = await supabase
      .from("invitations")
      .select(`id, email, workspace_id, invited_by, expires_at, accepted_at, workspaces ( id, name )`)
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      console.error("Invitation lookup error:", inviteError);
      return new Response(
        JSON.stringify({ error: "Invitation not found or invalid." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Found invitation:", { 
      id: invite.id, 
      email: invite.email, 
      workspace_id: invite.workspace_id,
      accepted_at: invite.accepted_at 
    });

    // Check expiration
    const now = new Date();
    const exp = new Date(invite.expires_at);
    if (exp < now) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already accepted?
    if (invite.accepted_at) {
      // Idempotent OK: return workspace either way
      return new Response(
        JSON.stringify({
          success: true,
          message: "Invitation already accepted.",
        workspace: { id: (invite.workspaces as any)?.id || invite.workspace_id, name: (invite.workspaces as any)?.name }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure the authenticated user's email matches the invitation email
    const invitedEmail = String(invite.email || "").toLowerCase();
    const userEmail = String(user.email || "").toLowerCase();
    console.log("Email validation:", { invitedEmail, userEmail, match: invitedEmail === userEmail });
    
    if (invitedEmail !== userEmail) {
      console.log("Email mismatch - invitation rejected");
      return new Response(
        JSON.stringify({ error: "This invitation is for a different email address." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already a member
    console.log("Checking if user is already a workspace member");
    const { data: existingMember, error: memberCheckError } = await supabase
      .from("workspace_members")
      .select("id, workspace_role")
      .eq("workspace_id", invite.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberCheckError) {
      console.error("Error checking existing membership:", memberCheckError);
    }
    
    console.log("Existing member check result:", existingMember);

    if (existingMember) {
      console.log("User is already a member, marking invitation as accepted");
      await supabase.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
      return new Response(
        JSON.stringify({
          success: true,
          message: "You are already a member of this workspace.",
          workspace: { id: (invite.workspaces as any)?.id || invite.workspace_id, name: (invite.workspaces as any)?.name }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user_id of the person who invited (since invited_by in invitations table stores profile.id)
    const { data: inviterProfile, error: inviterError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", invite.invited_by)
      .single();

    if (inviterError) {
      console.error("Error getting inviter profile:", inviterError);
      // Continue with null invited_by if we can't find the inviter
    }

    const inviterUserId = inviterProfile?.user_id || null;
    
    // Add member with guest role by default
    console.log('Adding user to workspace_members:', { 
      workspace_id: invite.workspace_id, 
      user_id: user.id, 
      role: "guest",
      invited_by: inviterUserId
    });
    
    try {
      const { data: insertData, error: insertError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: invite.workspace_id,
          user_id: user.id,
          workspace_role: "guest",
          invited_by: inviterUserId, // Use auth.users.id, not profiles.id
          invited_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Insert error details:", {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });
        
        // If it's a constraint violation, provide more specific error
        if (insertError.code === '23505') { // Unique constraint violation
          console.log("User is already a member of this workspace");
          // Mark invitation as accepted anyway and continue
          await supabase.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
          return new Response(
            JSON.stringify({
              success: true,
              message: "You are already a member of this workspace.",
              workspace: { id: (invite.workspaces as any)?.id || invite.workspace_id, name: (invite.workspaces as any)?.name }
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: `Failed to add to workspace: ${insertError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log("Successfully added user to workspace_members:", insertData);
    } catch (error) {
      console.error("Unexpected error during workspace member insertion:", error);
      return new Response(
        JSON.stringify({ error: "Unexpected error occurred while adding you to the workspace" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark invitation as accepted
    console.log("Marking invitation as accepted");
    const { error: updateError } = await supabase
      .from("invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
      
    if (updateError) {
      console.error("Error marking invitation as accepted:", updateError);
      // Don't fail the whole operation for this
    }

    console.log("=== ACCEPT INVITATION SUCCESS ===");
    return new Response(
      JSON.stringify({
        success: true,
        workspace: { id: (invite.workspaces as any)?.id || invite.workspace_id, name: (invite.workspaces as any)?.name }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("accept-invitation unexpected error:", error); // Edge function deployment fix
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
