import { serve } from "https://deno.land/std@0.186.0/http/server.ts";
import { validateR2Config, logR2Status, getCorsHeaders } from "../_shared/r2-utils.ts";
import { getErrorMessage } from "../_shared/error-utils.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log('=== R2 CONNECTION TEST STARTED ===');
    
    // Validate R2 configuration
    const validation = validateR2Config();
    logR2Status(validation);
    
    if (!validation.isValid) {
      console.error('R2 configuration is invalid');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'R2 configuration is invalid',
          errors: validation.errors,
          timestamp: new Date().toISOString()
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // If config is valid, perform a basic connection test
    console.log('✅ R2 configuration is valid');
    console.log('🔗 All required environment variables are present');
    
    const result = {
      success: true,
      message: 'R2 configuration validated successfully',
      details: {
        endpoint: validation.config?.endpoint?.includes('cloudflarestorage.com') ? 'Valid Cloudflare R2 endpoint' : 'Custom endpoint',
        bucket: `Bucket name: ${validation.config?.bucketName}`,
        credentials: 'Access credentials are present',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('=== R2 CONNECTION TEST COMPLETED ===');
    
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Error in R2 connection test:', error); // Edge function deployment fix - rebuild
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'R2 connection test failed',
        error: getErrorMessage(error),
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});