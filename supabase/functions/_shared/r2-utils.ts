// Enhanced R2 utilities with better error handling and logging

export interface R2Config {
  endpoint: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface R2ValidationResult {
  isValid: boolean;
  errors: string[];
  config?: Partial<R2Config>;
}

export const validateR2Config = (): R2ValidationResult => {
  const errors: string[] = [];
  const config: Partial<R2Config> = {};

  // Check each required environment variable
  const endpoint = Deno.env.get('CLOUDFLARE_R2_ENDPOINT');
  const bucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME');
  const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY');

  if (!endpoint) {
    errors.push('CLOUDFLARE_R2_ENDPOINT is not set');
  } else {
    config.endpoint = endpoint;
  }

  if (!bucketName) {
    errors.push('CLOUDFLARE_R2_BUCKET_NAME is not set');
  } else {
    config.bucketName = bucketName;
  }

  if (!accessKeyId) {
    errors.push('CLOUDFLARE_R2_ACCESS_KEY_ID is not set');
  } else {
    config.accessKeyId = accessKeyId;
  }

  if (!secretAccessKey) {
    errors.push('CLOUDFLARE_R2_SECRET_ACCESS_KEY is not set');
  } else {
    config.secretAccessKey = secretAccessKey;
  }

  return {
    isValid: errors.length === 0,
    errors,
    config: errors.length === 0 ? config as R2Config : config
  };
};

export const logR2Status = (validation: R2ValidationResult) => {
  console.log('=== R2 CONFIGURATION STATUS ===');
  console.log(`Valid: ${validation.isValid}`);
  
  if (validation.errors.length > 0) {
    console.log('Errors:');
    validation.errors.forEach(error => console.log(`  ❌ ${error}`));
  }
  
  if (validation.config) {
    console.log('Available config:');
    Object.entries(validation.config).forEach(([key, value]) => {
      if (key.includes('secret') || key.includes('Secret')) {
        console.log(`  ✅ ${key}: [REDACTED - ${value ? value.length : 0} chars]`);
      } else {
        console.log(`  ✅ ${key}: ${value}`);
      }
    });
  }
  console.log('=== END R2 STATUS ===');
};

export const getCorsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
});