import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, 
      { status: 200, headers: corsHeaders }
    );
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { postId, workspaceId } = await req.json();
    
    if (!postId) {
      return new Response(
        JSON.stringify({ error: 'Post ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for secure operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Initialize user client for permission checks
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🗑️ Delete post request for post ${postId} by user ${user.id}`);

    // Check if post exists and user has permission (using user client)
    const { data: postData, error: postError } = await supabaseUser
      .from('posts')
      .select('id, workspace_id, title, media_urls, thumbnail_urls, created_by')
      .eq('id', postId)
      .single();

    if (postError) {
      console.error('Post fetch error:', postError);
      return new Response(
        JSON.stringify({ 
          error: 'Post not found or access denied',
          details: postError.message
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!postData) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🗑️ Found post: ${postData.title} with ${postData.media_urls?.length || 0} media files`);

    // Step 1: Delete the post (this will trigger media cleanup automatically via DB trigger)
    const { error: deleteError } = await supabaseUser
      .from('posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      console.error('Post deletion error:', deleteError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete post',
          details: deleteError.message,
          code: deleteError.code
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🗑️ Post ${postId} deleted successfully`);

    // Step 2: Trigger media cleanup (optional - DB trigger should handle this)
    if (workspaceId) {
      try {
        const { error: cleanupError } = await supabaseAdmin.functions.invoke('cleanup-deleted-media', {
          body: { workspace_id: workspaceId, manual_trigger: true }
        });
        
        if (cleanupError) {
          console.warn('Media cleanup warning:', cleanupError);
        } else {
          console.log('🗑️ Media cleanup triggered successfully');
        }
      } catch (cleanupException) {
        console.warn('Media cleanup exception (non-critical):', cleanupException);
      }
    }

    // Step 3: Recalculate storage usage for the user
    try {
      const { data: workspaces } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id);

      if (workspaces && workspaces.length > 0) {
        const workspaceIds = workspaces.map(w => w.id);
        
        // Calculate total storage across all user's workspaces
        const { data: mediaAssets } = await supabaseAdmin
          .from('media_assets')
          .select('size_bytes')
          .in('workspace_id', workspaceIds)
          .is('deleted_at', null);

        const totalBytes = mediaAssets?.reduce((sum, asset) => sum + (asset.size_bytes || 0), 0) || 0;
        const totalMB = Math.round(totalBytes / (1024 * 1024));

        // Update user's storage usage
        const { error: storageUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ storage_used_mb: totalMB })
          .eq('user_id', user.id);

        if (storageUpdateError) {
          console.warn('Storage update warning:', storageUpdateError);
        } else {
          console.log(`📊 Updated storage usage to ${totalMB}MB for user ${user.id}`);
        }
      }
    } catch (storageException) {
      console.warn('Storage calculation exception (non-critical):', storageException);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Post deleted successfully',
        postId: postId
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Delete post safe - unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: getErrorMessage(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});