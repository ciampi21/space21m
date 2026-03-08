import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// AWS V4 Signature functions for R2
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
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return new Uint8Array(signature);
}

async function createSignature(
  method: string,
  canonicalUri: string,
  canonicalQuery: string,
  canonicalHeaders: string,
  signedHeaders: string,
  hashedPayload: string,
  accessKey: string,
  secretKey: string,
  region: string,
  service: string,
  dateStamp: string,
  amzDate: string
): Promise<string> {
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
  
  const encoder = new TextEncoder();
  let kDate = await hmacSha256(encoder.encode(`AWS4${secretKey}`), dateStamp);
  let kRegion = await hmacSha256(kDate, region);
  let kService = await hmacSha256(kRegion, service);
  let kSigning = await hmacSha256(kService, 'aws4_request');
  
  const signature = await hmacSha256(kSigning, stringToSign);
  return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deleteFromR2(key: string): Promise<boolean> {
  try {
    const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID')!;
    const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY')!;
    const endpoint = Deno.env.get('CLOUDFLARE_R2_ENDPOINT')!;
    const bucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME')!;
    
    const url = new URL(`${endpoint}/${bucketName}/${key}`);
    const host = url.hostname;
    const canonicalUri = url.pathname;
    
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);
    
    const hashedPayload = await sha256('');
    
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${hashedPayload}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    
    const signature = await createSignature(
      'DELETE',
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      hashedPayload,
      accessKeyId,
      secretAccessKey,
      'us-east-1',
      's3',
      dateStamp,
      amzDate
    );
    
    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/us-east-1/s3/aws4_request,SignedHeaders=${signedHeaders},Signature=${signature}`;
    
    console.log(`🗑️ Attempting to delete from R2: ${key}`);
    
    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        'Host': host,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': hashedPayload,
        'Authorization': authorizationHeader
      }
    });
    
    const success = response.status === 204 || response.status === 200;
    console.log(`📊 R2 deletion response for ${key}: ${response.status} ${response.statusText}`);
    
    if (!success) {
      const responseText = await response.text();
      console.error(`❌ R2 deletion failed for ${key}:`, responseText);
    }
    
    return success;
  } catch (error) {
    console.error(`❌ Error deleting ${key} from R2:`, error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧹 Starting manual thumbnail cleanup...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get thumbnails pending deletion
    const { data: pendingDeletions, error: dbError } = await supabase.rpc('get_pending_media_deletions');
    
    if (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(JSON.stringify({ error: 'Database error', details: dbError }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filter for thumbnails specifically
    const thumbnails = pendingDeletions?.filter((item: any) => 
      item.r2_key && (
        item.r2_key.includes('-thumb.webp') || 
        item.r2_key.includes('thumbnail') ||
        item.r2_key.includes('thumb')
      )
    ) || [];

    console.log(`🖼️ Found ${thumbnails.length} thumbnails to clean up`);

    const results = {
      thumbnailsProcessed: 0,
      successfulDeletions: 0,
      failedDeletions: 0,
      errors: [] as string[],
      details: [] as any[]
    };

    // Process each thumbnail
    for (const thumbnail of thumbnails) {
      results.thumbnailsProcessed++;
      console.log(`🔄 Processing thumbnail ${results.thumbnailsProcessed}/${thumbnails.length}: ${thumbnail.r2_key}`);
      
      try {
        // Attempt to delete from R2
        const r2Success = await deleteFromR2(thumbnail.r2_key);
        
        if (r2Success) {
          results.successfulDeletions++;
          console.log(`✅ Successfully deleted thumbnail from R2: ${thumbnail.r2_key}`);
          
          // Remove from database
          const { error: deleteError } = await supabase
            .from('media_assets')
            .delete()
            .eq('id', thumbnail.id);
            
          if (deleteError) {
            console.error(`⚠️ Failed to remove thumbnail from database: ${thumbnail.r2_key}`, deleteError);
            results.errors.push(`Database removal failed for ${thumbnail.r2_key}: ${deleteError.message}`);
          } else {
            console.log(`🗑️ Removed thumbnail from database: ${thumbnail.r2_key}`);
          }
        } else {
          results.failedDeletions++;
          console.error(`❌ Failed to delete thumbnail from R2: ${thumbnail.r2_key}`);
          results.errors.push(`R2 deletion failed for ${thumbnail.r2_key}`);
        }
        
        results.details.push({
          key: thumbnail.r2_key,
          r2Success,
          workspaceId: thumbnail.workspace_id,
          deletedAt: thumbnail.deleted_at
        });
        
      } catch (error) {
        results.failedDeletions++;
        const errorMsg = `Error processing ${thumbnail.r2_key}: ${getErrorMessage(error)}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    console.log(`🏁 Manual cleanup completed. Success: ${results.successfulDeletions}, Failed: ${results.failedDeletions}`);

    return new Response(JSON.stringify({
      message: 'Manual thumbnail cleanup completed',
      ...results,
      summary: `Processed ${results.thumbnailsProcessed} thumbnails: ${results.successfulDeletions} deleted, ${results.failedDeletions} failed`
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Manual cleanup function error:', error); // Edge function deployment fix
    return new Response(JSON.stringify({ 
      error: 'Manual cleanup failed', 
      details: getErrorMessage(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});