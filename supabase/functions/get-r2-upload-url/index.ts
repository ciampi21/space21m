import { serve } from "https://deno.land/std@0.186.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from "../_shared/r2-fetch.ts";

const corsHeaders = getCorsHeaders();

interface UploadUrlRequest {
  key: string;
  contentType: string;
  contentLength: number;
}

// Generate AWS V4 Signature for presigned URL
async function generatePresignedUrl(
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn: number = 3600
): Promise<string> {
  const endpoint = Deno.env.get('CLOUDFLARE_R2_ENDPOINT')!;
  const bucket = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME')!;
  const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID')!;
  const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY')!;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresIn * 1000);
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);

  // Build URL with query parameters
  const url = new URL(`${endpoint}/${bucket}/${key}`);
  
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${dateStamp}/us-east-1/s3/aws4_request`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'content-type;host',
  });

  // Canonical request
  const canonicalUri = `/${bucket}/${key}`;
  const canonicalQuery = params.toString();
  const canonicalHeaders = `content-type:${contentType}\nhost:${new URL(endpoint).host}\n`;
  const signedHeaders = 'content-type;host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // String to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/us-east-1/s3/aws4_request`;
  const requestHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest));
  const requestHashHex = Array.from(new Uint8Array(requestHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    requestHashHex
  ].join('\n');

  // Signing key
  const kDate = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmac(kDate, 'us-east-1');
  const kService = await hmac(kRegion, 's3');
  const kSigning = await hmac(kService, 'aws4_request');

  const signature = await hmac(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Add signature to params
  params.append('X-Amz-Signature', signatureHex);

  const presignedUrl = `${url.origin}${url.pathname}?${params.toString()}`;
  
  console.log('Generated presigned URL:', {
    key,
    contentType,
    expiresIn,
    urlLength: presignedUrl.length
  });

  return presignedUrl;
}

async function hmac(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔑 get-r2-upload-url: Starting...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: UploadUrlRequest = await req.json();
    const { key, contentType, contentLength } = body;

    if (!key || !contentType || !contentLength) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: key, contentType, contentLength' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating presigned URL for:', { key, contentType, contentLength });

    // Generate presigned URL (expires in 1 hour)
    const uploadUrl = await generatePresignedUrl(key, contentType, contentLength, 3600);

    // Get public URL
    const customDomain = Deno.env.get('R2_CUSTOM_DOMAIN');
    const endpoint = Deno.env.get('CLOUDFLARE_R2_ENDPOINT')!;
    const bucket = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME')!;
    const publicUrl = customDomain 
      ? `https://${customDomain}/${key}` 
      : `${endpoint}/${bucket}/${key}`;

    return new Response(
      JSON.stringify({
        uploadUrl,
        publicUrl,
        key,
        expiresIn: 3600
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
    console.error('get-r2-upload-url error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate upload URL', 
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
