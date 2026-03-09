import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, prompt, duration, aspectRatio, videoUrl, falRequestId, workspaceId, generationId, status, errorMessage } = await req.json();

    if (action === "create") {
      // Check plan limits
      const { data: profileData } = await supabase
        .from("profiles")
        .select("plan_tier")
        .eq("user_id", user.id)
        .single();

      const planTier = profileData?.plan_tier || "free";
      const maxGenerations = planTier === "free" ? 10 : 100;

      const { count } = await supabase
        .from("ai_video_generations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_permanent", false)
        .neq("status", "error");

      if ((count || 0) >= maxGenerations) {
        return new Response(JSON.stringify({
          error: `Limite de ${maxGenerations} gerações atingido. Salve algumas permanentemente ou delete as antigas.`,
          limitReached: true,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create record
      const { data, error } = await supabaseAdmin
        .from("ai_video_generations")
        .insert({
          user_id: user.id,
          workspace_id: workspaceId || null,
          prompt: prompt || "",
          duration: duration || "5",
          aspect_ratio: aspectRatio || "16:9",
          fal_request_id: falRequestId || null,
          status: "generating",
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ generation: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      if (!generationId) throw new Error("generationId is required");

      const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (videoUrl) updateData.video_url = videoUrl;
      if (errorMessage) updateData.error_message = errorMessage;
      if (status === "error") updateData.expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabaseAdmin
        .from("ai_video_generations")
        .update(updateData)
        .eq("id", generationId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ generation: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("save-ai-video-generation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
