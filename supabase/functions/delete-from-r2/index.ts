import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@^3.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteRequest {
  key: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header and verify user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const requestData: DeleteRequest = await req.json();

    if (!requestData.key) {
      return new Response('Missing key', { status: 400, headers: corsHeaders });
    }

    console.log('Searching for media asset with R2 key:', requestData.key);
    console.log('User ID:', user.id);

    // Find the media asset and verify ownership
    const { data: mediaAsset, error: findError } = await supabase
      .from('media_assets')
      .select('workspace_id, owner_user_id, id')
      .eq('r2_key', requestData.key)
      .maybeSingle();

    if (findError) {
      console.error('Database error finding media asset:', findError);
      return new Response('Database error', { status: 500, headers: corsHeaders });
    }

    if (!mediaAsset) {
      console.log('Media asset not found for R2 key:', requestData.key);
      return new Response('File not found', { status: 404, headers: corsHeaders });
    }

    console.log('Found media asset:', mediaAsset.id, 'in workspace:', mediaAsset.workspace_id);

    // Check workspace ownership first
    const { data: ownedWorkspace, error: ownedError } = await supabase
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', mediaAsset.workspace_id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (ownedError) {
      console.error('Error checking workspace ownership:', ownedError);
    }

    let hasAccess = false;

    if (ownedWorkspace) {
      console.log('User owns workspace:', ownedWorkspace.id);
      hasAccess = true;
    } else {
      // Check if user is a member of the workspace
      console.log('User does not own workspace, checking membership...');
      const { data: membership, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('workspace_id', mediaAsset.workspace_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError) {
        console.error('Error checking workspace membership:', memberError);
      }

      if (membership) {
        console.log('User is member of workspace with role:', membership.role);
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      console.log('Access denied - user has no access to workspace:', mediaAsset.workspace_id);
      return new Response('Access denied', { status: 403, headers: corsHeaders });
    }

    console.log('Access granted for user:', user.id, 'to delete media from workspace:', mediaAsset.workspace_id);

    // Initialize R2 client
    const R2_ENDPOINT = Deno.env.get('CLOUDFLARE_R2_ENDPOINT');
    const R2_ACCESS_KEY_ID = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME');

    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      console.error('Missing R2 configuration');
      return new Response('Server configuration error', { status: 500, headers: corsHeaders });
    }

    const r2Client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    // Delete from R2
    const deleteCommand = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: requestData.key,
    });

    await r2Client.send(deleteCommand);

    // Mark as deleted in database (soft delete)
    const { error: dbError } = await supabase
      .from('media_assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('r2_key', requestData.key);

    if (dbError) {
      console.error('Database update error:', dbError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Delete error:', error); // Edge function deployment fix
    return new Response(
      JSON.stringify({ error: 'Delete failed', details: getErrorMessage(error) }),
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