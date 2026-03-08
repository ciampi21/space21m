import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Initialize Supabase client with service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if token exists and is valid in profiles table
    const { data, error } = await supabase
      .from("profiles")
      .select("email, setup_token_used_at, setup_token_expires_at, user_id")
      .eq("setup_token", token)
      .single();

    if (error || !data) {
      console.log("Token not found:", token);
      return new Response(
        JSON.stringify({ error: "Token inválido ou não encontrado" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // Check if token is already used
    if (data.setup_token_used_at) {
      return new Response(
        JSON.stringify({ error: "Este link já foi utilizado" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Check if token is expired
    if (data.setup_token_expires_at) {
      const expiresAt = new Date(data.setup_token_expires_at);
      if (expiresAt < new Date()) {
        return new Response(
          JSON.stringify({ error: "Este link expirou. Entre em contato com o suporte." }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }
    }

    console.log("Token validated successfully for:", data.email);

    return new Response(
      JSON.stringify({
        valid: true,
        email: data.email,
        user_id: data.user_id
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error validating token:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});