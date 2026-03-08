import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, imageUrl, duration, aspectRatio } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) {
      throw new Error("FAL_KEY is not configured");
    }

    // Build request body for FAL.ai
    const body: Record<string, unknown> = {
      prompt,
      duration: duration || "5",
      aspect_ratio: aspectRatio || "16:9",
    };

    // If image provided, use image-to-video endpoint
    if (imageUrl) {
      body.image_url = imageUrl;
    }

    const endpoint = imageUrl
      ? "https://queue.fal.run/fal-ai/kling-video/v2/master/image-to-video"
      : "https://queue.fal.run/fal-ai/kling-video/v2/master/text-to-video";

    console.log("Submitting to FAL.ai:", endpoint, JSON.stringify({ prompt: body.prompt, hasImage: !!imageUrl }));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("FAL.ai error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `FAL.ai error: ${response.status} - ${errorText}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("FAL.ai response:", JSON.stringify(data));

    return new Response(JSON.stringify({
      requestId: data.request_id,
      statusUrl: data.status_url,
      responseUrl: data.response_url,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ai-video error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
