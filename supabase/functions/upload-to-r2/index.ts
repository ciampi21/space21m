import { serve } from "https://deno.land/std@0.186.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getErrorMessage } from "../_shared/error-utils.ts";
import { 
  loadR2Env, 
  base64ToUint8Array, 
  getR2ConfigResponse,
  getCorsHeaders,
  uploadToR2,
  r2HealthCheck
} from "../_shared/r2-fetch.ts";

const corsHeaders = getCorsHeaders();

interface UploadRequest {
  key: string;
  file_data: string; // base64 encoded
  mime_type: string;
  workspace_id: string;
  user_id: string;
  file_size?: number; // Legacy compatibility
  file_size_bytes?: number; // New field name
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  const url = new URL(req.url);
  if (url.searchParams.get('health_check') === 'true') {
    console.log('R2 health check requested via upload endpoint');
    
    try {
      const envErr = getR2ConfigResponse();
      if (envErr) {
        return new Response(JSON.stringify({
          success: false,
          message: 'R2 configuration invalid',
          details: 'Missing required environment variables'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Upload endpoint is healthy',
        details: {
          endpoint: 'upload-to-r2',
          r2Config: 'valid',
          timestamp: new Date().toISOString()
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Health check failed',
        error: getErrorMessage(error)
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    console.log("Starting R2 upload process...");

    // Validate R2 configuration early
    const envErr = getR2ConfigResponse();
    if (envErr) return envErr;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header and verify user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('User authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    const body = await req.json();
    const { workspace_id, user_id, key, file_data, mime_type, file_size } = body || {};

    // Validate input
    if (!workspace_id || !key || !mime_type || !file_data) {
      console.error('Missing required fields:', { 
        hasWorkspaceId: !!workspace_id,
        hasKey: !!key,
        hasMimeType: !!mime_type,
        hasFileData: !!file_data
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Upload request received:', {
      workspace_id,
      user_id,
      key,
      mime_type,
      file_size: file_size || file_data.length
    });

    // Check if user belongs to workspace
    console.log('Checking workspace access for user:', user.id, 'workspace:', workspace_id);
    
    // First check if user owns the workspace
    const { data: ownedWorkspace, error: ownedError } = await supabase
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', workspace_id)
      .eq('owner_id', user.id)
      .maybeSingle();

    console.log('Owned workspace check:', { ownedWorkspace, ownedError });

    let hasAccess = false;
    
    if (ownedWorkspace) {
      hasAccess = true;
      console.log('User owns workspace');
    } else {
      // Check if user is a member of the workspace
      const { data: memberCheck, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('workspace_id', workspace_id)
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('Member workspace check:', { memberCheck, memberError });

      if (memberCheck) {
        hasAccess = true;
        console.log('User is member of workspace');
      }
    }

    if (!hasAccess) {
      console.error('Access denied to workspace:', workspace_id, 'for user:', user.id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Access denied to workspace',
          details: `User ${user.id} does not have access to workspace ${workspace_id}`
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Workspace access confirmed');

    // Use the key provided by frontend (already includes the full path)
    const finalKey = key;

    console.log('Using file key from frontend:', finalKey);

    // Convert base64 to Uint8Array
    const bytes = base64ToUint8Array(file_data);
    console.log('File converted to buffer, size:', bytes.length, 'bytes');

    // Upload to R2 using Fetch API
    const env = loadR2Env();
    console.log('R2 environment loaded:', { 
      hasBucket: !!env.bucket, 
      hasAccessKey: !!env.accessKeyId,
      hasSecretKey: !!env.secretAccessKey,
      hasEndpoint: !!env.endpoint 
    });
    console.log('Attempting upload to R2 using Fetch API...');
    
    const uploadResult = await uploadToR2(finalKey, bytes, mime_type, env);
    
    if (!uploadResult.success) {
      console.error('R2 upload failed:', uploadResult.error);
      return new Response(JSON.stringify({
        success: false,
        error: uploadResult.error || 'Upload failed',
        code: 'R2_UPLOAD_ERROR'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    console.log('R2 upload successful!', uploadResult);

    // Generate file hash for deduplication from bytes (create new Uint8Array for type compatibility)
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Extract file name from the key
    const fileName = finalKey.split('/').pop() || 'unknown';
    
    // Save media asset record to database with complete information
    console.log('Saving media asset record to database...');
    const { error: dbError } = await supabase
      .from('media_assets')
      .insert({
        workspace_id: workspace_id,
        owner_user_id: user.id,
        r2_key: finalKey,
        mime_type: mime_type,
        size_bytes: bytes.length,
        file_hash: fileHash,
        uploaded_by: user.id
      });

    if (dbError) {
      console.error('Database error:', dbError);
      // Note: File is already uploaded to R2, could implement cleanup here
    } else {
      console.log('Media asset record saved successfully');
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: uploadResult.url,
        key: uploadResult.key,
        r2: { bucket: env.bucket, key: finalKey },
        mime_type,
        file_hash: fileHash
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
    console.error('Upload error:', error); // Edge function deployment fix
    
    // Enhanced error handling with proper type checking
    let errorCode = 'UPLOAD_ERROR';
    let errorMessage = getErrorMessage(error);
    
    // Check for specific error types
    if (errorMessage.includes('R2_')) {
      errorCode = 'R2_API_ERROR';
      errorMessage = 'R2 API error: ' + errorMessage;
    } else if (errorMessage.includes('fetch')) {
      errorCode = 'NETWORK_ERROR';
      errorMessage = 'Network error during upload';
    } else if (errorMessage.includes('auth')) {
      errorCode = 'AUTH_ERROR';
      errorMessage = 'Authentication error';
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Upload failed', 
        details: errorMessage,
        code: errorCode,
        timestamp: new Date().toISOString()
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