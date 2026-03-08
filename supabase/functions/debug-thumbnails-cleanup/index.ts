import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Starting thumbnail cleanup debug...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all pending media deletions
    const { data: pendingDeletions, error: dbError } = await supabase.rpc('get_pending_media_deletions');
    
    if (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(JSON.stringify({ error: 'Database error', details: dbError }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Total pending deletions found: ${pendingDeletions?.length || 0}`);

    // Filter thumbnails specifically (files containing 'thumb' or ending with '-thumb.webp')
    const thumbnails = pendingDeletions?.filter((item: any) => 
      item.r2_key && (
        item.r2_key.includes('-thumb.webp') || 
        item.r2_key.includes('thumbnail') ||
        item.r2_key.includes('thumb')
      )
    ) || [];

    console.log(`🖼️ Thumbnails found for deletion: ${thumbnails.length}`);

    // Get R2 environment variables
    const r2AccessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID');
    const r2SecretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    const r2Endpoint = Deno.env.get('CLOUDFLARE_R2_ENDPOINT');
    const r2BucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME');

    if (!r2AccessKeyId || !r2SecretAccessKey || !r2Endpoint || !r2BucketName) {
      return new Response(JSON.stringify({ 
        error: 'Missing R2 configuration',
        missing: [
          !r2AccessKeyId && 'CLOUDFLARE_R2_ACCESS_KEY_ID',
          !r2SecretAccessKey && 'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
          !r2Endpoint && 'CLOUDFLARE_R2_ENDPOINT',
          !r2BucketName && 'CLOUDFLARE_R2_BUCKET_NAME'
        ].filter(Boolean)
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const debugInfo = {
      totalPendingDeletions: pendingDeletions?.length || 0,
      thumbnailsFound: thumbnails.length,
      thumbnails: thumbnails.map((thumb: any) => ({
        id: thumb.id,
        r2_key: thumb.r2_key,
        workspace_id: thumb.workspace_id,
        deleted_at: thumb.deleted_at,
        age_hours: Math.floor((new Date().getTime() - new Date(thumb.deleted_at).getTime()) / (1000 * 60 * 60))
      })),
      r2Config: {
        hasAccessKey: !!r2AccessKeyId,
        hasSecretKey: !!r2SecretAccessKey,
        hasEndpoint: !!r2Endpoint,
        hasBucket: !!r2BucketName,
        endpoint: r2Endpoint,
        bucket: r2BucketName
      }
    };

    // Test R2 connection for thumbnails
    const r2TestResults = [];
    
    for (const thumbnail of thumbnails.slice(0, 3)) { // Test first 3 thumbnails
      console.log(`🧪 Testing R2 connection for thumbnail: ${thumbnail.r2_key}`);
      
      try {
        // Create signed request to check if file exists
        const url = `${r2Endpoint}/${r2BucketName}/${thumbnail.r2_key}`;
        const date = new Date();
        const dateString = date.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
        
        // Simple HEAD request to check if file exists
        const headResponse = await fetch(url, {
          method: 'HEAD'
        });
        
        r2TestResults.push({
          key: thumbnail.r2_key,
          exists: headResponse.status === 200,
          status: headResponse.status,
          statusText: headResponse.statusText
        });
        
        console.log(`📍 Thumbnail ${thumbnail.r2_key}: exists=${headResponse.status === 200}, status=${headResponse.status}`);
        
      } catch (error) {
        console.error(`❌ Error testing thumbnail ${thumbnail.r2_key}:`, error);
        r2TestResults.push({
          key: thumbnail.r2_key,
          exists: false,
          error: getErrorMessage(error)
        });
      }
    }

    const response = {
      ...debugInfo,
      r2TestResults,
      recommendations: [
        thumbnails.length > 0 ? "📌 Found thumbnails pending deletion" : "✅ No thumbnails pending deletion",
        r2TestResults.some(r => r.exists) ? "⚠️ Some thumbnails still exist in R2 - cleanup function may need improvement" : "✅ Thumbnails not found in R2 (may already be deleted)",
        "💡 Consider running manual cleanup function to force deletion"
      ]
    };

    return new Response(JSON.stringify(response, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Debug function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Debug function failed', 
      details: getErrorMessage(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});