import { serve } from "https://deno.land/std@0.186.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    console.log("🧹 Starting cleanup of stuck uploads...");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the cleanup function
    const { data, error } = await supabase.rpc('cleanup_stuck_uploads');

    if (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }

    const cleanedCount = data || 0;
    console.log(`✅ Cleanup completed: ${cleanedCount} posts updated`);

    return new Response(
      JSON.stringify({
        success: true,
        cleaned_posts: cleanedCount,
        message: `Successfully cleaned up ${cleanedCount} stuck uploads`
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Cleanup error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to cleanup stuck uploads', 
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
