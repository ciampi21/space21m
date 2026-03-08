import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { requestId, statusUrl } = await req.json();

    if (!requestId && !statusUrl) {
      return new Response(JSON.stringify({ error: "requestId or statusUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) {
      throw new Error("FAL_KEY is not configured");
    }

    const url = statusUrl || `https://queue.fal.run/fal-ai/kling-video/v2/master/image-to-video/requests/${requestId}/status`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("FAL.ai status error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `Status check failed: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // If completed, fetch the result
    if (data.status === "COMPLETED") {
      const responseUrl = statusUrl 
        ? statusUrl.replace("/status", "") 
        : `https://queue.fal.run/fal-ai/kling-video/v2/master/image-to-video/requests/${requestId}`;
      
      const resultResponse = await fetch(responseUrl, {
        method: "GET",
        headers: {
          Authorization: `Key ${FAL_KEY}`,
        },
      });

      if (resultResponse.ok) {
        const resultData = await resultResponse.json();
        return new Response(JSON.stringify({
          status: "COMPLETED",
          videoUrl: resultData.video?.url || resultData.data?.video?.url,
          result: resultData,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      status: data.status || "IN_PROGRESS",
      progress: data.progress,
      logs: data.logs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-video-status error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
