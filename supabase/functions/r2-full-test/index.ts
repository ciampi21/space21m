import { serve } from "https://deno.land/std@0.186.0/http/server.ts";
import { validateR2Config, logR2Status, getCorsHeaders } from "../_shared/r2-utils.ts";
import { getErrorMessage } from "../_shared/error-utils.ts";

// Simplified test function
async function testBasicConfig() {
  console.log('🔍 Testing basic R2 configuration...');
  
  const validation = validateR2Config();
  logR2Status(validation);
  
  if (!validation.isValid) {
    throw new Error(`R2 configuration invalid: ${validation.errors.join(', ')}`);
  }
  
  console.log('✅ Basic R2 configuration is valid');
  return validation.config!;
}

// Test simple connectivity without upload
async function testConnectivity(config: any) {
  console.log('🌐 Testing basic connectivity...');
  
  try {
    const testUrl = `${config.endpoint}/${config.bucketName}/`;
    console.log(`Testing connectivity to: ${testUrl}`);
    
    // Simple HEAD request to test connectivity
    const response = await fetch(testUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Supabase-Edge-Function/1.0'
      }
    });
    
    console.log(`Connectivity test response: ${response.status}`);
    return { success: true, status: response.status };
  } catch (error) {
    console.error('Connectivity test failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log('=== R2 SIMPLIFIED TEST STARTED ===');
    
    // Step 1: Test basic configuration
    const config = await testBasicConfig();
    
    // Step 2: Test basic connectivity
    const connectivityResult = await testConnectivity(config);
    
    if (!connectivityResult.success) {
      console.error('❌ Connectivity test failed');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'R2 connectivity test failed',
          error: connectivityResult.error,
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('✅ Basic connectivity successful');
    
    // Step 3: Return simplified success response
    const result = {
      success: true,
      message: 'R2 simplified test completed successfully',
      details: {
        configValid: true,
        connectivityTest: 'PASSED',
        connectivityStatus: connectivityResult.status,
        endpoint: config.endpoint,
        bucket: config.bucketName,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('=== R2 SIMPLIFIED TEST COMPLETED SUCCESSFULLY ===');
    
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('❌ Error in R2 simplified test:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'R2 simplified test failed',
        error: getErrorMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});