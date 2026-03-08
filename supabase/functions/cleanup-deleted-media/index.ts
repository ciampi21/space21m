import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { getErrorMessage, getErrorDetails } from "../_shared/error-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Manual R2 deletion using fetch API (same approach as upload-to-r2)
async function deleteFromR2(key: string): Promise<boolean> {
  try {
    console.log(`=== R2 DELETE DEBUG ===`)
    console.log(`Deleting key: ${key}`)

    const R2_ENDPOINT = Deno.env.get('CLOUDFLARE_R2_ENDPOINT')
    const R2_ACCESS_KEY_ID = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID')
    const R2_SECRET_ACCESS_KEY = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
    const R2_BUCKET_NAME = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME')

    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      throw new Error('Missing R2 configuration')
    }

    console.log(`Bucket: ${R2_BUCKET_NAME}`)
    console.log(`Endpoint: ${R2_ENDPOINT}`)

    // Create URL for deletion
    const url = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`
    console.log(`Delete URL: ${url}`)

    // Create AWS V4 signature for DELETE request
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '')
    const dateStamp = amzDate.substring(0, 8)

    const host = new URL(R2_ENDPOINT).host
    const canonicalUri = `/${R2_BUCKET_NAME}/${key}`

    const payloadHash = 'UNSIGNED-PAYLOAD'

    const canonicalHeaders = [
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`
    ].join('\n') + '\n'

    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'

    const canonicalRequest = [
      'DELETE',
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n')

    const credentialScope = `${dateStamp}/us-east-1/s3/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await sha256(canonicalRequest)
    ].join('\n')

    const signature = await createSignature(stringToSign, R2_SECRET_ACCESS_KEY, dateStamp)
    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`

    const headers = {
      'Host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Authorization': authorizationHeader
    }

    console.log(`Authorization: ${authorizationHeader}`)

    const response = await fetch(url, {
      method: 'DELETE',
      headers
    })

    console.log(`Response status: ${response.status} ${response.statusText}`)

    if (response.ok) {
      console.log(`Successfully deleted ${key} from R2`)
      return true
    } else {
      const errorText = await response.text()
      console.error(`Failed to delete ${key}: ${response.status} - ${errorText}`)
      return false
    }

  } catch (error) {
    console.error(`Error deleting ${key} from R2:`, error)
    return false
  }
}

// Helper functions for AWS signature
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(keyData: ArrayBuffer | Uint8Array | string, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  
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
  )
  const signature = await crypto.subtle.sign('HMAC', keyObject, encoder.encode(message))
  return new Uint8Array(signature)
}

async function createSignature(stringToSign: string, secretKey: string, dateStamp: string): Promise<string> {
  let key: Uint8Array = await hmacSha256(`AWS4${secretKey}`, dateStamp)
  key = await hmacSha256(key, 'us-east-1')
  key = await hmacSha256(key, 's3')
  key = await hmacSha256(key, 'aws4_request')
  
  const signature = await hmacSha256(key, stringToSign)
  return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body to get context
    let requestBody = {};
    try {
      const body = await req.text();
      if (body) {
        requestBody = JSON.parse(body);
      }
    } catch (e) {
      console.log('No request body or invalid JSON, proceeding with defaults');
    }
    
    console.log('=== STARTING MEDIA CLEANUP PROCESS ===')
    console.log('Request body:', requestBody)
    console.log('Cleanup context:', (requestBody as any).deletion_context || 'scheduled')
    console.log('Manual trigger:', (requestBody as any).manual_trigger || false)
    console.log('Workspace ID:', (requestBody as any).workspace_id || 'all')
    
    const startTime = Date.now()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    console.log(`Supabase URL: ${supabaseUrl ? 'configured' : 'missing'}`)
    console.log(`Service Key: ${supabaseServiceKey ? 'configured' : 'missing'}`)
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // =================
    // PHASE 1: R2 CLEANUP (recent deletions)
    // =================
    console.log('\n=== PHASE 1: R2 CLEANUP ===')
    console.log('Fetching pending media deletions for R2 cleanup...')
    
    // Check if this is a specific workspace deletion context
    const workspaceId = (requestBody as any).workspace_id
    const deletionContext = (requestBody as any).deletion_context
    
    let pendingDeletions, pendingError
    
    if (workspaceId && deletionContext === 'workspace_deletion') {
      console.log(`🔥 WORKSPACE DELETION MODE: Fetching ALL media for workspace ${workspaceId}`)
      // For workspace deletion, get ALL media marked as deleted for this workspace (no time limit)
      const result = await supabase
        .from('media_assets')
        .select('id, r2_key, workspace_id, deleted_at')
        .eq('workspace_id', workspaceId)
        .not('deleted_at', 'is', null)
        .not('r2_key', 'is', null)
      
      pendingDeletions = result.data
      pendingError = result.error
      
      console.log(`🔥 Found ${pendingDeletions?.length || 0} media items for workspace ${workspaceId}`)
    } else {
      console.log('🕐 SCHEDULED MODE: Using standard pending deletions query')
      // Standard mode: only recent deletions
      const result = await supabase.rpc('get_pending_media_deletions')
      pendingDeletions = result.data
      pendingError = result.error
    }

    if (pendingError) {
      console.error('Error fetching pending deletions:', pendingError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending deletions', details: pendingError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    let r2SuccessCount = 0
    let r2ErrorCount = 0
    const r2Results = []

    if (pendingDeletions && pendingDeletions.length > 0) {
      console.log(`Found ${pendingDeletions.length} media items to delete from R2`)

      // Validate R2 configuration
      const R2_ENDPOINT = Deno.env.get('CLOUDFLARE_R2_ENDPOINT')
      const R2_ACCESS_KEY_ID = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID')
      const R2_SECRET_ACCESS_KEY = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
      const R2_BUCKET_NAME = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME')

      if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
        const missingVars = []
        if (!R2_ENDPOINT) missingVars.push('CLOUDFLARE_R2_ENDPOINT')
        if (!R2_ACCESS_KEY_ID) missingVars.push('CLOUDFLARE_R2_ACCESS_KEY_ID')
        if (!R2_SECRET_ACCESS_KEY) missingVars.push('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
        if (!R2_BUCKET_NAME) missingVars.push('CLOUDFLARE_R2_BUCKET_NAME')
        
        const errorMsg = `Missing R2 configuration: ${missingVars.join(', ')}`
        console.error(errorMsg)
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Separate thumbnails from other media for detailed logging
      const thumbnails = pendingDeletions.filter((deletion: any) => 
        deletion.r2_key && (
          deletion.r2_key.includes('-thumb.webp') || 
          deletion.r2_key.includes('thumbnail') ||
          deletion.r2_key.includes('thumb')
        )
      );
      
      const otherMedia = pendingDeletions.filter((deletion: any) => 
        deletion.r2_key && !(
          deletion.r2_key.includes('-thumb.webp') || 
          deletion.r2_key.includes('thumbnail') ||
          deletion.r2_key.includes('thumb')
        )
      );
      
      console.log(`📊 Media breakdown: ${thumbnails.length} thumbnails, ${otherMedia.length} other media files`);

      // Process R2 deletions with retry logic
      for (const deletion of pendingDeletions) {
        const isThumbnal = thumbnails.includes(deletion);
        const mediaType = isThumbnal ? '🖼️ THUMBNAIL' : '📁 MEDIA';
        
        console.log(`\n--- Processing R2 deletion ${deletion.id} ---`)
        console.log(`${mediaType} - Key: ${deletion.r2_key}`)
        console.log(`${mediaType} - Deleted at: ${deletion.deleted_at}`)

        let success = false
        let lastError = null

        // Try up to 3 times
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            success = await deleteFromR2(deletion.r2_key)
            if (success) {
              console.log(`✅ ${mediaType} - R2 deletion successful for ${deletion.r2_key} (attempt ${attempt})`)
              break
            } else {
              console.log(`⚠️ ${mediaType} - R2 deletion returned false for ${deletion.r2_key} (attempt ${attempt})`)
            }
          } catch (deleteError) {
            lastError = deleteError
            console.error(`❌ ${mediaType} - R2 deletion failed for ${deletion.r2_key} (attempt ${attempt}):`, deleteError)
          }
          
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        if (success) {
          r2SuccessCount++
          r2Results.push({ id: deletion.id, r2_key: deletion.r2_key, status: 'success', type: mediaType })
          
          // Remove from database after successful R2 deletion
          const { error: dbDeleteError } = await supabase
            .from('media_assets')
            .delete()
            .eq('id', deletion.id);
            
          if (dbDeleteError) {
            console.error(`⚠️ ${mediaType} - Failed to remove from database after R2 deletion: ${deletion.r2_key}`, dbDeleteError);
          } else {
            console.log(`🗑️ ${mediaType} - Removed from database: ${deletion.r2_key}`);
          }
        } else {
          r2ErrorCount++
          const errorMsg = getErrorMessage(lastError) || 'Failed after 3 attempts';
          console.error(`❌ ${mediaType} - Final failure for ${deletion.r2_key}: ${errorMsg}`);
          r2Results.push({ 
            id: deletion.id, 
            r2_key: deletion.r2_key, 
            status: 'error', 
            type: mediaType,
            error: errorMsg
          })
        }
      }
    } else {
      console.log('No pending R2 deletions found')
    }

    // =================
    // PHASE 2: DATABASE CLEANUP (old processed deletions)
    // =================
    console.log('\n=== PHASE 2: DATABASE CLEANUP ===')
    console.log('Fetching old processed deletions for database cleanup...')

    // Get media assets deleted more than 7 days ago for physical removal
    const { data: oldDeletions, error: oldError } = await supabase
      .from('media_assets')
      .select('id, r2_key, workspace_id, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1000) // Safety limit

    if (oldError) {
      console.error('Error fetching old deletions:', oldError)
    } else {
      console.log(`Found ${oldDeletions?.length || 0} old records to physically remove from database`)
    }

    let dbSuccessCount = 0
    let dbErrorCount = 0
    const dbResults: any[] = []

    if (oldDeletions && oldDeletions.length > 0) {
      // Process database cleanup in batches
      const batchSize = 50
      for (let i = 0; i < oldDeletions.length; i += batchSize) {
        const batch = oldDeletions.slice(i, i + batchSize)
        const batchIds = batch.map(item => item.id)
        
        console.log(`\n--- Processing DB cleanup batch ${Math.floor(i/batchSize) + 1} (${batch.length} records) ---`)
        
        try {
          const { error: deleteError } = await supabase
            .from('media_assets')
            .delete()
            .in('id', batchIds)

          if (deleteError) {
            console.error(`❌ Database cleanup batch failed:`, deleteError)
            dbErrorCount += batch.length
            batch.forEach(item => {
              dbResults.push({
                id: item.id,
                r2_key: item.r2_key,
                status: 'error',
                error: deleteError.message
              })
            })
          } else {
            console.log(`✅ Successfully removed ${batch.length} records from database`)
            dbSuccessCount += batch.length
            batch.forEach(item => {
              dbResults.push({
                id: item.id,
                r2_key: item.r2_key,
                status: 'success'
              })
            })
          }
        } catch (batchError) {
          console.error(`❌ Database cleanup batch exception:`, batchError)
          dbErrorCount += batch.length
        }

        // Small delay between batches
        if (i + batchSize < oldDeletions.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }

    // =================
    // FINAL SUMMARY
    // =================
    const endTime = Date.now()
    const executionTime = endTime - startTime

    console.log(`\n=== WEEKLY CLEANUP COMPLETED ===`)
    console.log(`Execution time: ${executionTime}ms`)
    console.log(`=== PHASE 1 (R2) SUMMARY ===`)
    console.log(`R2 processed: ${pendingDeletions?.length || 0}`)
    console.log(`R2 successful: ${r2SuccessCount}`)
    console.log(`R2 failed: ${r2ErrorCount}`)
    console.log(`=== PHASE 2 (DB) SUMMARY ===`)
    console.log(`DB processed: ${oldDeletions?.length || 0}`)
    console.log(`DB successful: ${dbSuccessCount}`)
    console.log(`DB failed: ${dbErrorCount}`)
    console.log(`=== TOTAL SUMMARY ===`)
    console.log(`Total processed: ${(pendingDeletions?.length || 0) + (oldDeletions?.length || 0)}`)
    console.log(`Total successful: ${r2SuccessCount + dbSuccessCount}`)
    console.log(`Total failed: ${r2ErrorCount + dbErrorCount}`)

    const response = {
      message: 'Weekly media cleanup completed',
      executionTime: executionTime,
      phase1_r2: {
        processed: pendingDeletions?.length || 0,
        success: r2SuccessCount,
        errors: r2ErrorCount,
        results: r2Results
      },
      phase2_db: {
        processed: oldDeletions?.length || 0,
        success: dbSuccessCount,
        errors: dbErrorCount,
        results: dbResults
      },
      totals: {
        processed: (pendingDeletions?.length || 0) + (oldDeletions?.length || 0),
        success: r2SuccessCount + dbSuccessCount,
        errors: r2ErrorCount + dbErrorCount
      },
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('=== FATAL ERROR IN WEEKLY CLEANUP ==='); // Edge function deployment fix - rebuild
    console.error('Error:', error)
    const errorDetails = getErrorDetails(error);
    console.error('Stack:', errorDetails.stack)
    
    return new Response(
      JSON.stringify({ 
        error: 'Weekly media cleanup failed', 
        details: errorDetails.message,
        stack: errorDetails.stack
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})