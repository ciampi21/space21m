import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidatePostRequest {
  workspace_id: string;
  user_id: string;
  scheduled_date?: string;
  media_count?: number;
}

interface ValidationResult {
  allowed: boolean;
  reason?: string;
  current_usage?: number;
  limit?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { workspace_id, user_id, scheduled_date, media_count = 0 }: ValidatePostRequest = await req.json();

    // Get user profile to check plan tier
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("plan_tier")
      .eq("user_id", user_id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching user profile:", profileError);
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          reason: "Não foi possível verificar o plano do usuário" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user belongs to workspace
    const { data: membership } = await supabaseClient
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user_id)
      .single();

    const { data: workspace } = await supabaseClient
      .from("workspaces")
      .select("*")
      .eq("id", workspace_id)
      .eq("owner_id", user_id)
      .single();

    if (!membership && !workspace) {
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          reason: "Usuário não pertence ao workspace" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current month's posts for this workspace
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const { data: monthlyPosts, error: postsError } = await supabaseClient
      .from("posts")
      .select("id")
      .eq("workspace_id", workspace_id)
      .gte("created_at", startOfMonth.toISOString())
      .lt("created_at", endOfMonth.toISOString());

    if (postsError) {
      console.error("Error fetching monthly posts:", postsError);
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          reason: "Erro ao verificar posts mensais" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentMonthlyPosts = monthlyPosts?.length || 0;

    // Define limits based on plan
    let monthlyPostLimit = 50; // Free plan default

    switch (profile.plan_tier) {
      case "basic":
        monthlyPostLimit = 100;
        break;
      case "premium":
        monthlyPostLimit = 500;
        break;
      case "business":
        monthlyPostLimit = 1000;
        break;
      case "enterprise":
        monthlyPostLimit = 2000;
        break;
    }

    // Check monthly post limit
    if (currentMonthlyPosts >= monthlyPostLimit) {
      return new Response(
        JSON.stringify({ 
          allowed: false,
          reason: `Limite mensal de ${monthlyPostLimit} posts atingido`,
          current_usage: currentMonthlyPosts,
          limit: monthlyPostLimit
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Media per post limits removed - users can attach unlimited files per post

    // Advanced scheduling limitation removed - all users can schedule posts for any future date

    // All validations passed
    return new Response(
      JSON.stringify({ 
        allowed: true,
        current_usage: currentMonthlyPosts,
        limit: monthlyPostLimit
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Validation error:", error); // Edge function deployment fix
    return new Response(
      JSON.stringify({ 
        allowed: false, 
        reason: "Erro interno do servidor" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});