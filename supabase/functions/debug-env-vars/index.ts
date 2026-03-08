import { serve } from "https://deno.land/std@0.186.0/http/server.ts";
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log("=== DEBUG ENV VARS FUNCTION STARTED ===");
    
    // Get all environment variables
    const allEnv = Deno.env.toObject();
    console.log("Total environment variables found:", Object.keys(allEnv).length);
    
    // Filter R2/Cloudflare related variables
    const r2Vars = Object.keys(allEnv).filter(k => 
      k.includes('CLOUDFLARE') || 
      k.includes('R2') || 
      k.includes('cloudflare') || 
      k.includes('r2')
    );
    
    console.log("R2/Cloudflare related variables found:", r2Vars);
    
    // Show all environment variable names (not values for security)
    const allVarNames = Object.keys(allEnv).sort();
    console.log("All environment variable names:", allVarNames);
    
    // Specifically check for our target variables
    const targetVars = [
      "CLOUDFLARE_R2_ENDPOINT",
      "CLOUDFLARE_R2_BUCKET_NAME", 
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY"
    ];
    
    const foundVars: Record<string, boolean> = {};
    const varDetails: Record<string, string> = {};
    
    console.log("=== CHECKING TARGET VARIABLES ===");
    for (const varName of targetVars) {
      const value = Deno.env.get(varName);
      foundVars[varName] = !!value;
      varDetails[varName] = value ? `Found (length: ${value.length})` : "NOT FOUND";
      console.log(`${varName}: ${varDetails[varName]}`);
    }
    
    // Check for variations of the variable names
    console.log("=== CHECKING VARIABLE NAME VARIATIONS ===");
    const variations = [
      "CLOUDFLARE_R2_ENDPOINT",
      "CLOUDFLARE_R2_BUCKET_NAME",
      "CLOUDFLARE_R2_ACCESS_KEY_ID", 
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      "R2_ENDPOINT",
      "R2_BUCKET_NAME",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY"
    ];
    
    for (const varName of variations) {
      const value = Deno.env.get(varName);
      if (value) {
        console.log(`FOUND VARIATION: ${varName} = ${value.substring(0, 8)}... (length: ${value.length})`);
      }
    }
    
    console.log("=== DEBUG ENV VARS FUNCTION COMPLETED ===");
    
    const response = {
      success: true,
      totalEnvVars: Object.keys(allEnv).length,
      r2RelatedVars: r2Vars,
      targetVarsStatus: foundVars,
      targetVarsDetails: varDetails,
      allVarNames: allVarNames,
      message: "Environment variables debug completed successfully"
    };
    
    return new Response(JSON.stringify(response, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error("Error in debug-env-vars function:", error); // Edge function deployment fix
    
    return new Response(JSON.stringify({
      success: false,
      error: getErrorMessage(error),
      message: "Failed to debug environment variables"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});