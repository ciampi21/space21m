// R2 Upload using pure Fetch API with AWS V4 Signature
// This implementation avoids AWS SDK compatibility issues with Deno Edge Runtime

type R2Env = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function loadR2Env(): R2Env {
  const get = (k: string) => {
    const value = Deno.env.get(k);
    console.log(`Reading env var ${k}: ${value ? `[length: ${value.length}] ${value.substring(0, 8)}...` : 'NOT_FOUND'}`);
    return value?.trim() || "";
  };
  
  console.log("=== DETAILED R2 ENV DEBUG ===");
  console.log("Available environment variables:");
  const allEnvKeys = Object.keys(Deno.env.toObject()).filter(k => k.includes('CLOUDFLARE') || k.includes('R2'));
  console.log("All R2/Cloudflare env vars found:", allEnvKeys);
  
  const endpoint = get("CLOUDFLARE_R2_ENDPOINT") || "";
  const bucket = get("CLOUDFLARE_R2_BUCKET_NAME") || "";
  const accessKeyId = get("CLOUDFLARE_R2_ACCESS_KEY_ID") || "";
  const secretAccessKey = get("CLOUDFLARE_R2_SECRET_ACCESS_KEY") || "";

  console.log("=== R2 ENVIRONMENT VARIABLES SUMMARY ===");
  console.log("CLOUDFLARE_R2_ENDPOINT:", endpoint ? `${endpoint.substring(0, 30)}... [length: ${endpoint.length}]` : "❌ MISSING");
  console.log("CLOUDFLARE_R2_BUCKET_NAME:", bucket ? `${bucket} [length: ${bucket.length}]` : "❌ MISSING");
  console.log("CLOUDFLARE_R2_ACCESS_KEY_ID:", accessKeyId ? `${accessKeyId.substring(0, 8)}... [length: ${accessKeyId.length}]` : "❌ MISSING");
  console.log("CLOUDFLARE_R2_SECRET_ACCESS_KEY:", secretAccessKey ? `${secretAccessKey.substring(0, 8)}... [length: ${secretAccessKey.length}]` : "❌ MISSING");
  
  console.log("Final validation:", {
    hasEndpoint: !!endpoint,
    hasBucket: !!bucket,
    hasAccessKey: !!accessKeyId,
    hasSecretKey: !!secretAccessKey,
    allValid: !!(endpoint && bucket && accessKeyId && secretAccessKey)
  });
  console.log("=== END R2 ENV DEBUG ===");

  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

export function getR2ConfigResponse(): Response | null {
  const env = loadR2Env();
  const hasEndpoint = !!env.endpoint;
  const hasBucket = !!env.bucket;
  const hasAccess = !!env.accessKeyId;
  const hasSecret = !!env.secretAccessKey;

  if (!hasEndpoint || !hasBucket || !hasAccess || !hasSecret) {
    return new Response(JSON.stringify({
      success: false,
      code: "R2_ENV_MISSING",
      message: "Missing required R2 environment variables",
      flags: { hasEndpoint, hasBucket, hasAccessKey: hasAccess, hasSecretKey: hasSecret }
    }), { 
      status: 500, 
      headers: { 
        "content-type": "application/json",
        ...getCorsHeaders()
      }
    });
  }

  return null;
}

// AWS V4 Signature implementation for R2
async function createSignature(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Uint8Array,
  env: R2Env,
  requestDate?: Date
): Promise<string> {
  const date = requestDate || new Date();
  // AWS V4 signature requires YYYYMMDDTHHMMSSZ format
  const dateString = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = dateString.substr(0, 8);
  
  console.log(`=== AWS V4 SIGNATURE DEBUG ===`);
  console.log(`Date: ${date.toISOString()}`);
  console.log(`Date String: ${dateString}`);
  console.log(`Date Stamp: ${dateStamp}`);
  
  // Canonical request
  const parsedUrl = new URL(url);
  const canonicalUri = parsedUrl.pathname;
  const canonicalQuery = parsedUrl.search.slice(1);
  
  console.log(`Canonical URI: ${canonicalUri}`);
  console.log(`Canonical Query: ${canonicalQuery}`);
  
  // Sort headers alphabetically for canonical request
  const sortedHeaders = Object.keys(headers)
    .sort()
    .map(key => ({ key: key.toLowerCase(), value: headers[key].trim() }));
  
  const canonicalHeaders = sortedHeaders
    .map(h => `${h.key}:${h.value}\n`)
    .join('');
  
  const signedHeaders = sortedHeaders
    .map(h => h.key)
    .join(';');
  
  console.log(`Canonical Headers:\n${canonicalHeaders}`);
  console.log(`Signed Headers: ${signedHeaders}`);
  
  // Hash payload
  const bodyHash = await crypto.subtle.digest('SHA-256', new Uint8Array(body));
  const bodyHashHex = Array.from(new Uint8Array(bodyHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  console.log(`Body Hash: ${bodyHashHex}`);
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    bodyHashHex
  ].join('\n');
  
  console.log(`Canonical Request:\n${canonicalRequest}`);
  
  // String to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/us-east-1/s3/aws4_request`;
  const requestHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest));
  const requestHashHex = Array.from(new Uint8Array(requestHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const stringToSign = [
    algorithm,
    dateString,
    credentialScope,
    requestHashHex
  ].join('\n');
  
  console.log(`String to Sign:\n${stringToSign}`);
  
  // Signing key
  const kDate = await hmac(`AWS4${env.secretAccessKey}`, dateStamp);
  const kRegion = await hmac(kDate, 'us-east-1');
  const kService = await hmac(kRegion, 's3');
  const kSigning = await hmac(kService, 'aws4_request');
  
  const signature = await hmac(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const authHeader = `${algorithm} Credential=${env.accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signatureHex}`;
  console.log(`Authorization Header: ${authHeader}`);
  console.log(`=== END AWS V4 SIGNATURE DEBUG ===`);
  
  return authHeader;
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

export async function uploadToR2(
  key: string,
  body: Uint8Array,
  contentType: string,
  env: R2Env = loadR2Env()
): Promise<{ success: boolean; url?: string; error?: string; key?: string }> {
  try {
    const url = `${env.endpoint}/${env.bucket}/${key}`;
    const now = new Date();
    // Use x-amz-date instead of Date header as per AWS V4 spec
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    
    console.log(`=== R2 UPLOAD DEBUG ===`);
    console.log(`URL: ${url}`);
    console.log(`Content-Type: ${contentType}`);
    console.log(`Body Length: ${body.length}`);
    console.log(`AMZ Date: ${amzDate}`);
    
    // Calculate content hash
    const contentHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(body))))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const headers: Record<string, string> = {
      'Host': new URL(env.endpoint).host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': contentHash,
      'Content-Type': contentType,
      'Content-Length': body.length.toString(),
    };
    
    console.log(`Headers before signing:`, headers);
    
    const authorization = await createSignature('PUT', url, headers, body, env, now);
    headers['Authorization'] = authorization;
    
    console.log(`Final headers:`, Object.keys(headers).map(k => `${k}: ${headers[k]}`));
    console.log(`Uploading to R2: ${key} (${body.length} bytes)`);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: body as BodyInit,
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`R2 upload failed: ${response.status} ${response.statusText}`);
      console.error(`Error response body:`, errorText);
      
      // Parse XML error if available
      let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
      if (errorText) {
        try {
          // Try to extract error from XML response
          const errorMatch = errorText.match(/<Message>(.*?)<\/Message>/);
          if (errorMatch) {
            errorMessage += ` - ${errorMatch[1]}`;
          } else {
            errorMessage += ` - ${errorText}`;
          }
        } catch {
          errorMessage += ` - ${errorText}`;
        }
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
    
    console.log(`R2 upload successful: ${key}`);
    console.log(`=== END R2 UPLOAD DEBUG ===`);
    
    // Check if custom domain is available
    const customDomain = Deno.env.get('R2_CUSTOM_DOMAIN');
    const publicUrl = customDomain 
      ? `https://${customDomain}/${key}` 
      : `${env.endpoint}/${env.bucket}/${key}`;
    
    console.log(`Using ${customDomain ? 'custom domain' : 'direct R2'} URL: ${publicUrl}`);
    
    return {
      success: true,
      url: publicUrl,
      key: key
    };
    
  } catch (error) {
    console.error('R2 upload error:', error);
    return {
      success: false,
      error: `Upload error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function r2HealthCheck(): Promise<Response> {
  const configError = getR2ConfigResponse();
  if (configError) return configError;

  const env = loadR2Env();
  const customDomain = Deno.env.get('R2_CUSTOM_DOMAIN');
  const testKey = `__health/__edge_${Date.now()}.txt`;
  const testBody = new TextEncoder().encode("health-check");
  
  console.log(`=== R2 HEALTH CHECK ===`);
  console.log(`Custom domain: ${customDomain || 'Not configured'}`);
  console.log(`Test key: ${testKey}`);
  
  try {
    const result = await uploadToR2(testKey, testBody, "text/plain", env);
    
    if (result.success) {
      console.log(`Health check successful, URL: ${result.url}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: "R2 connection OK",
        testKey,
        url: result.url,
        customDomain: customDomain || null,
        usingCustomDomain: !!customDomain
      }), {
        status: 200, 
        headers: { 
          "content-type": "application/json",
          ...getCorsHeaders()
        }
      });
    } else {
      console.error(`Health check failed: ${result.error}`);
      return new Response(JSON.stringify({ 
        success: false, 
        code: "R2_UPLOAD_FAILED",
        message: result.error,
        timestamp: new Date().toISOString()
      }), {
        status: 500, 
        headers: { 
          "content-type": "application/json",
          ...getCorsHeaders()
        }
      });
    }
  } catch (error) {
    console.error("R2 health check error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      code: "R2_HEALTH_ERROR",
      message: error instanceof Error ? error.message : "Health check failed",
      timestamp: new Date().toISOString()
    }), {
      status: 500, 
      headers: { 
        "content-type": "application/json",
        ...getCorsHeaders()
      }
    });
  }
}

// Convert base64 to Uint8Array
export function base64ToUint8Array(b64: string): Uint8Array {
  const clean = b64.replace(/^data:.*;base64,/, "");
  const bin = atob(clean);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}