import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';
import { getErrorMessage } from "../_shared/error-utils.ts";

// AWS V4 Signature helpers for R2 deletion - Fixed version
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(keyData: ArrayBuffer | Uint8Array | string, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  
  // Convert input to a clean ArrayBuffer
  let keyBuffer: ArrayBuffer;
  if (typeof keyData === 'string') {
    const encoded = encoder.encode(keyData);
    keyBuffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
  } else if (keyData instanceof Uint8Array) {
    // Create a clean ArrayBuffer from Uint8Array to avoid SharedArrayBuffer issues
    const newKeyData = new Uint8Array(keyData);
    keyBuffer = newKeyData.buffer;
  } else {
    keyBuffer = keyData;
  }
  
  const keyObject = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', keyObject, encoder.encode(message));
  return new Uint8Array(signature);
}

async function createSignature(stringToSign: string, secretKey: string, dateStamp: string): Promise<string> {
  let key: Uint8Array = await hmacSha256(`AWS4${secretKey}`, dateStamp);
  key = await hmacSha256(key, 'us-east-1'); // Fixed: use us-east-1 instead of auto
  key = await hmacSha256(key, 's3');
  key = await hmacSha256(key, 'aws4_request');
  const signature = await hmacSha256(key, stringToSign);
  return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deleteFromR2(key: string): Promise<boolean> {
  try {
    const endpoint = Deno.env.get('CLOUDFLARE_R2_ENDPOINT');
    const bucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME');
    const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY');

    if (!endpoint || !bucketName || !accessKeyId || !secretAccessKey) {
      console.error('Missing R2 configuration for key:', key);
      return false;
    }

    const url = `${endpoint}/${bucketName}/${key}`;
    const now = new Date();
    const dateStamp = now.toISOString().split('T')[0].replace(/-/g, '');
    const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    
    // Fixed: Calculate empty payload hash
    const payloadHash = await sha256('');

    // Fixed: Proper canonical request with x-amz-content-sha256 header
    const canonicalRequest = [
      'DELETE',
      `/${bucketName}/${key}`,
      '',
      `host:${new URL(endpoint).hostname}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${timestamp}`,
      '',
      'host;x-amz-content-sha256;x-amz-date', // Fixed: include x-amz-content-sha256 in signed headers
      payloadHash
    ].join('\n');

    const credentialScope = `${dateStamp}/us-east-1/s3/aws4_request`; // Fixed: use us-east-1
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      timestamp,
      credentialScope,
      await sha256(canonicalRequest)
    ].join('\n');

    const signature = await createSignature(stringToSign, secretAccessKey, dateStamp);
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Host': new URL(endpoint).hostname,
        'X-Amz-Date': timestamp,
        'X-Amz-Content-Sha256': payloadHash, // Fixed: include required header
        'Authorization': authorization,
      },
    });

    const success = response.status === 204 || response.status === 200;
    if (!success) {
      console.error(`R2 delete failed for ${key}: ${response.status} ${response.statusText}`);
      const responseText = await response.text().catch(() => 'Unable to read response');
      console.error('Response body:', responseText);
    }
    
    return success;
  } catch (error) {
    console.error(`Error deleting ${key} from R2:`, error);
    return false;
  }
}

function extractR2KeyFromUrl(url: string): string | null {
  if (!url) return null;
  
  // Handle custom domain URLs (media.21m.space)
  if (url.includes('media.21m.space/')) {
    const keyMatch = url.match(/media\.21m\.space\/(.+)$/);
    return keyMatch ? keyMatch[1] : null;
  }
  
  // Handle R2.dev URLs
  if (url.includes('.r2.dev/')) {
    const keyMatch = url.match(/\.r2\.dev\/(.+)$/);
    return keyMatch ? keyMatch[1] : null;
  }
  
  return null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteWorkspaceRequest {
  workspaceId: string;
}

interface DeleteResponse {
  success: boolean;
  message: string;
  cleanup_summary?: {
    posts_deleted: number;
    media_marked_deleted: number;
    workspace_members_deleted: number;
    invitations_deleted: number;
    analytics_deleted: number;
    r2_cleanup_success: boolean;
    r2_cleanup_error: string | null;
    r2_cleanup_details: any;
  };
  error?: string;
}

Deno.serve(async (req) => {
  console.log('Starting delete-workspace-complete function');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Parse request body
    const { workspaceId }: DeleteWorkspaceRequest = await req.json();

    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    console.log(`Starting complete deletion for workspace: ${workspaceId}`);

    // Verify user owns the workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, owner_id, name')
      .eq('id', workspaceId)
      .eq('owner_id', user.id)
      .single();

    if (workspaceError || !workspace) {
      throw new Error('Workspace not found or access denied');
    }

    console.log(`Verified ownership of workspace: ${workspace.name}`);

    // Initialize cleanup counters
    let postsDeleted = 0;
    let mediaMarkedDeleted = 0;
    let membersDeleted = 0;
    let invitationsDeleted = 0;
    let analyticsDeleted = 0;

    // Step 1: Get all posts and their media
    console.log('Step 1: Fetching posts and media...');
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, media_urls, thumbnail_urls')
      .eq('workspace_id', workspaceId);

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      throw new Error('Failed to fetch workspace posts');
    }

    console.log(`Found ${posts?.length || 0} posts to process`);

    // Step 2: Collect and delete media from R2 directly
    console.log('Step 2: Collecting media for R2 cleanup...');
    
    // Extract R2 keys from all posts
    const r2Keys: string[] = [];
    
    if (posts) {
      for (const post of posts) {
        // Extract keys from media_urls
        if (post.media_urls && Array.isArray(post.media_urls)) {
          for (const url of post.media_urls) {
            if (url) {
              const key = extractR2KeyFromUrl(url);
              if (key) r2Keys.push(key);
            }
          }
        }
        
        
        // Extract keys from thumbnail_urls array
        if (post.thumbnail_urls && Array.isArray(post.thumbnail_urls)) {
          for (const url of post.thumbnail_urls) {
            if (url) {
              const key = extractR2KeyFromUrl(url);
              if (key) r2Keys.push(key);
            }
          }
        }
      }
    }
    
    // Get all media assets from this workspace that aren't already deleted
    const { data: workspaceMedia, error: workspaceMediaError } = await supabase
      .from('media_assets')
      .select('id, r2_key, file_url')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (workspaceMediaError) {
      console.error('Error fetching workspace media:', workspaceMediaError);
    } else if (workspaceMedia && workspaceMedia.length > 0) {
      console.log(`Found ${workspaceMedia.length} media assets to process`);
      
      // Add media asset keys to the list
      for (const asset of workspaceMedia) {
        if (asset.r2_key && !r2Keys.includes(asset.r2_key)) {
          r2Keys.push(asset.r2_key);
        }
      }
    }
    
    // Remove duplicates and filter out empty keys
    const uniqueR2Keys = [...new Set(r2Keys)].filter(key => key && key.trim() !== '');
    console.log(`Total unique R2 keys to delete: ${uniqueR2Keys.length}`);
    console.log('R2 keys to delete:', uniqueR2Keys);
    
    // Delete files from R2 directly (before removing database records)
    let r2SuccessCount = 0;
    let r2FailureCount = 0;
    const r2Results: Array<{key: string, success: boolean, error?: string}> = [];
    
    if (uniqueR2Keys.length > 0) {
      console.log('Starting direct R2 cleanup...');
      
      for (const key of uniqueR2Keys) {
        try {
          const success = await deleteFromR2(key);
          if (success) {
            r2SuccessCount++;
            r2Results.push({ key, success: true });
            console.log(`✅ Successfully deleted from R2: ${key}`);
          } else {
            r2FailureCount++;
            r2Results.push({ key, success: false, error: 'Delete operation failed' });
            console.log(`❌ Failed to delete from R2: ${key}`);
          }
        } catch (error) {
          r2FailureCount++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          r2Results.push({ key, success: false, error: errorMsg });
          console.log(`❌ Error deleting from R2 (${key}): ${errorMsg}`);
        }
        
        // Small delay between deletions to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`R2 cleanup completed: ${r2SuccessCount} successful, ${r2FailureCount} failed`);
    }
    
    // Now mark media assets as deleted in database
    if (workspaceMedia && workspaceMedia.length > 0) {
      const { error: markError } = await supabase
        .from('media_assets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null);

      if (markError) {
        console.error('Error marking media as deleted:', markError);
      } else {
        mediaMarkedDeleted = workspaceMedia.length;
        console.log(`Successfully marked ${mediaMarkedDeleted} media assets as deleted`);
      }
    } else {
      console.log('No media assets found for this workspace');
    }

    // Step 3: Delete posts
    console.log('Step 3: Deleting posts...');
    const { data: deletedPosts, error: deletePostsError } = await supabase
      .from('posts')
      .delete()
      .eq('workspace_id', workspaceId)
      .select('id');

    if (deletePostsError) {
      console.error('Error deleting posts:', deletePostsError);
    } else {
      postsDeleted = deletedPosts?.length || 0;
      console.log(`Deleted ${postsDeleted} posts`);
    }

    // Step 4: Delete workspace members
    console.log('Step 4: Deleting workspace members...');
    const { data: deletedMembers, error: deleteMembersError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .select('id');

    if (deleteMembersError) {
      console.error('Error deleting workspace members:', deleteMembersError);
    } else {
      membersDeleted = deletedMembers?.length || 0;
      console.log(`Deleted ${membersDeleted} workspace members`);
    }

    // Step 5: Delete invitations
    console.log('Step 5: Deleting invitations...');
    const { data: deletedInvitations, error: deleteInvitationsError } = await supabase
      .from('invitations')
      .delete()
      .eq('workspace_id', workspaceId)
      .select('id');

    if (deleteInvitationsError) {
      console.error('Error deleting invitations:', deleteInvitationsError);
    } else {
      invitationsDeleted = deletedInvitations?.length || 0;
      console.log(`Deleted ${invitationsDeleted} invitations`);
    }

    // Step 6: Delete analytics data
    console.log('Step 6: Deleting analytics data...');
    
    // Delete monthly analytics
    const { data: deletedMonthlyAnalytics, error: deleteMonthlyError } = await supabase
      .from('monthly_analytics')
      .delete()
      .eq('workspace_id', workspaceId)
      .select('id');

    // Delete platform analytics
    const { data: deletedPlatformAnalytics, error: deletePlatformError } = await supabase
      .from('platform_analytics')
      .delete()
      .eq('workspace_id', workspaceId)
      .select('id');

    // Delete workspace analytics snapshots
    const { data: deletedSnapshots, error: deleteSnapshotsError } = await supabase
      .from('workspace_analytics_snapshots')
      .delete()
      .eq('workspace_id', workspaceId)
      .select('id');

    // Delete follower stats
    const { data: deletedFollowerStats, error: deleteFollowerStatsError } = await supabase
      .from('follower_stats')
      .delete()
      .eq('workspace_id', workspaceId)
      .select('id');

    analyticsDeleted = (deletedMonthlyAnalytics?.length || 0) + 
                      (deletedPlatformAnalytics?.length || 0) + 
                      (deletedSnapshots?.length || 0) + 
                      (deletedFollowerStats?.length || 0);

    console.log(`Deleted ${analyticsDeleted} analytics records`);

    // Step 7: Delete the workspace itself
    console.log('Step 7: Deleting workspace...');
    const { error: deleteWorkspaceError } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId);

    if (deleteWorkspaceError) {
      console.error('Error deleting workspace:', deleteWorkspaceError);
      throw new Error('Failed to delete workspace');
    }

    console.log(`Successfully deleted workspace: ${workspace.name}`);

    // Step 8: Update R2 cleanup summary with direct results
    console.log('Step 8: Updating cleanup summary...');
    
    // Use the direct R2 cleanup results instead of calling external function
    const r2CleanupSuccess = r2FailureCount === 0; // Success if no failures
    const r2CleanupError = r2FailureCount > 0 ? `${r2FailureCount} files failed to delete from R2` : null;
    const r2CleanupDetails = {
      total_processed: uniqueR2Keys.length,
      successful: r2SuccessCount,
      failed: r2FailureCount,
      results: r2Results.slice(0, 10) // Include first 10 results for debugging
    };
    
    console.log(`Direct R2 cleanup summary: ${r2SuccessCount} successful, ${r2FailureCount} failed out of ${uniqueR2Keys.length} total files`);
    
    // Remove old media_assets records (they were marked as deleted before R2 cleanup)
    if (workspaceMedia && workspaceMedia.length > 0) {
      const { error: removeRecordsError } = await supabase
        .from('media_assets')
        .delete()
        .eq('workspace_id', workspaceId);
      
      if (removeRecordsError) {
        console.error('Error removing media_assets records:', removeRecordsError);
      } else {
        console.log(`Removed ${workspaceMedia.length} media_assets records from database`);
      }
    }

    const cleanup_summary = {
      posts_deleted: postsDeleted,
      media_marked_deleted: mediaMarkedDeleted,
      workspace_members_deleted: membersDeleted,
      invitations_deleted: invitationsDeleted,
      analytics_deleted: analyticsDeleted,
      r2_cleanup_success: r2CleanupSuccess,
      r2_cleanup_error: r2CleanupError,
      r2_cleanup_details: r2CleanupDetails
    };

    // Log comprehensive summary
    console.log('=== WORKSPACE DELETION SUMMARY ===');
    console.log('Workspace:', workspace.name);
    console.log('Posts deleted:', postsDeleted);
    console.log('Media marked for deletion:', mediaMarkedDeleted);
    console.log('Members deleted:', membersDeleted);
    console.log('Invitations deleted:', invitationsDeleted);
    console.log('Analytics records deleted:', analyticsDeleted);
    console.log('R2 cleanup successful:', r2CleanupSuccess);
    if (r2CleanupError) {
      console.log('R2 cleanup error:', r2CleanupError);
    }
    console.log('=== END SUMMARY ===');

    const response: DeleteResponse = {
      success: true,
      message: r2CleanupSuccess 
        ? `Workspace "${workspace.name}" and all related data deleted successfully, including ${mediaMarkedDeleted} media files from R2`
        : `Workspace "${workspace.name}" deleted successfully, but R2 cleanup ${r2CleanupError ? 'failed: ' + r2CleanupError : 'had issues'}`,
      cleanup_summary
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in delete-workspace-complete:', error);
    
    const response: DeleteResponse = {
      success: false,
      message: 'Failed to delete workspace',
      error: getErrorMessage(error)
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});