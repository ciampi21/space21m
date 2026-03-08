import { serve } from "https://deno.land/std@0.186.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getErrorMessage } from "../_shared/error-utils.ts";
import { 
  loadR2Env, 
  getR2ConfigResponse,
  getCorsHeaders,
  uploadToR2
} from "../_shared/r2-fetch.ts";

const corsHeaders = getCorsHeaders();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting async thumbnail generation...");

    // Validate R2 configuration early
    const envErr = getR2ConfigResponse();
    if (envErr) return envErr;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { video_url, workspace_id, user_id, post_id, media_index } = body || {};

    console.log('Thumbnail generation request:', {
      video_url,
      workspace_id,
      user_id,
      post_id,
      media_index
    });

    // Start background thumbnail generation using a promise that resolves immediately
    // but continues processing in the background
    const backgroundTask = (async () => {
      try {
        console.log('Background task: Starting thumbnail generation for', video_url);
        
        // This function is now deprecated - thumbnails are generated on frontend
        console.log('WARNING: generate-thumbnail-async is deprecated. Thumbnails should be generated on frontend.');
        const thumbnailData = generateVideoThumbnailFallback();
        
        // Convert SVG data URI to bytes
        const base64Data = thumbnailData.split(',')[1];
        const bytes = new Uint8Array(atob(base64Data).split('').map(char => char.charCodeAt(0)));
        
        // Generate thumbnail key
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2);
        const thumbnailKey = `workspaces/${workspace_id}/thumbnails/${timestamp}-${randomId}.svg`;
        
        // Upload thumbnail to R2
        const env = loadR2Env();
        const uploadResult = await uploadToR2(thumbnailKey, bytes, 'image/svg+xml', env);
        
        if (!uploadResult.success) {
          console.error('Background task: Thumbnail upload failed:', uploadResult.error);
          return;
        }

        console.log('Background task: Thumbnail uploaded successfully:', uploadResult.url);

        // Update post with thumbnail URL
        const { data: currentPost } = await supabase
          .from('posts')
          .select('thumbnail_urls')
          .eq('id', post_id)
          .single();

        if (currentPost) {
          const thumbnailUrls = [...(currentPost.thumbnail_urls || [])];
          thumbnailUrls[media_index] = uploadResult.url;
          
          await supabase
            .from('posts')
            .update({ thumbnail_urls: thumbnailUrls })
            .eq('id', post_id);
        }

        console.log('Background task: Thumbnail generation completed successfully');
        
      } catch (error) {
        console.error('Background task thumbnail error:', error);
      }
    })();

    // Don't await the background task, just let it run
    backgroundTask.catch((err) => console.error('Background task error:', err));

    // Return immediate response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thumbnail generation started in background'
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
    console.error('Async thumbnail error:', error); // Edge function deployment fix - rebuild v3
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to start thumbnail generation', 
        details: getErrorMessage(error)
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

// Fallback thumbnail generation (same as existing implementation)
function generateVideoThumbnailFallback(): string {
  const svg = `<svg width="320" height="180" viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="320" height="180" fill="#1f2937"/>
    <rect x="130" y="65" width="60" height="50" rx="8" fill="#374151"/>
    <path d="M150 85L170 95L150 105V85Z" fill="#9ca3af"/>
    <text x="160" y="130" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">Video Preview</text>
  </svg>`;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}