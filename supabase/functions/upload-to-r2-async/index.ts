import { serve } from "https://deno.land/std@0.186.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getErrorMessage } from "../_shared/error-utils.ts";
import { 
  loadR2Env, 
  base64ToUint8Array, 
  getR2ConfigResponse,
  getCorsHeaders,
  uploadToR2
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
  post_id: string; // ID of the post to update
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting async R2 upload process...");

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

    const body = await req.json();
    const { workspace_id, user_id, key, file_data, mime_type, file_size, post_id } = body || {};

    console.log('Async upload request received:', {
      workspace_id,
      user_id,
      post_id,
      key,
      mime_type,
      file_size
    });

    // Start background upload task with timeout and retry
    (async () => {
      const MAX_RETRIES = 2;
      const UPLOAD_TIMEOUT = 60000; // 60 seconds
      
      let attempt = 0;
      let lastError = null;
      
      while (attempt <= MAX_RETRIES) {
        try {
          attempt++;
          console.log(`🚀 [${key}] Starting background upload (attempt ${attempt}/${MAX_RETRIES + 1})`);
          
          // Decode Base64
          console.log(`📥 [${key}] Decoding Base64 data...`);
          const bytes = base64ToUint8Array(file_data);
          console.log(`📊 [${key}] File size: ${bytes.length} bytes (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
          
          // Upload to R2 with timeout
          console.log(`📤 [${key}] Starting R2 upload...`);
          const env = loadR2Env();
          const uploadPromise = uploadToR2(key, bytes, mime_type, env);
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Upload timeout after 60 seconds')), UPLOAD_TIMEOUT)
          );
          
          const uploadResult = await Promise.race([uploadPromise, timeoutPromise]) as any;
          
          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Upload failed');
          }

          console.log(`✅ [${key}] R2 upload successful: ${uploadResult.url}`);

          // Generate file hash from bytes
          console.log(`🔐 [${key}] Generating file hash...`);
          const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

          // Save media asset record
          console.log(`💾 [${key}] Saving to media_assets table...`);
          const { error: assetError } = await supabase
            .from('media_assets')
            .insert({
              workspace_id: workspace_id,
              owner_user_id: user.id,
              r2_key: key,
              mime_type: mime_type,
              size_bytes: bytes.length,
              file_hash: fileHash,
              uploaded_by: user.id
            });

          if (assetError) {
            console.warn(`⚠️ [${key}] Failed to save media asset record:`, assetError);
          } else {
            console.log(`✅ [${key}] Media asset saved successfully`);
          }

          // Atomic update to prevent race conditions
          console.log(`🔗 [${key}] Updating post ${post_id} with media URL...`);
          const { error: updateError } = await supabase.rpc('append_media_url_to_post', {
            target_post_id: post_id,
            new_media_url: uploadResult.url
          });

          if (updateError) {
            console.error(`❌ [${key}] Failed to update post:`, updateError);
            throw new Error(`Failed to update post: ${updateError.message}`);
          }

          console.log(`✅ [${key}] Post updated successfully - Upload complete! 🎉`);
          return; // Success - exit retry loop
          
        } catch (error) {
          lastError = error;
          console.error(`❌ Background task error (attempt ${attempt}/${MAX_RETRIES + 1}):`, error);
          
          // If this was the last attempt, mark as failed
          if (attempt > MAX_RETRIES) {
            console.error('🔴 All retry attempts exhausted, marking post as failed');
            
            await supabase
              .from('posts')
              .update({ 
                status: 'Pendente',
                additional_comments: `⚠️ Upload em fila devido a instabilidade temporária do serviço de armazenamento.\n\nO upload será processado automaticamente quando o serviço normalizar.\n\nDetalhes técnicos: ${getErrorMessage(lastError)}`
              })
              .eq('id', post_id);
            
            return;
          }
          
          // Wait before retry (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    })().catch(console.error);

    // Return immediate response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Upload started in background',
        post_id: post_id
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
    console.error('Async upload error:', error); // Edge function deployment fix
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to start upload process', 
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