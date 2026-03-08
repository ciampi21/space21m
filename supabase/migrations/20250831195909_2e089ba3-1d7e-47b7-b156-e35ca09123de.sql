-- Enable HTTP extension for making external requests
CREATE EXTENSION IF NOT EXISTS http;

-- Create function to get Supabase configuration
CREATE OR REPLACE FUNCTION get_supabase_config()
RETURNS TABLE(url text, service_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Return hardcoded values for the current project
  RETURN QUERY SELECT 
    'https://lqbpqecybxdylqjedwza.supabase.co'::text as url,
    current_setting('app.supabase_service_role_key', true)::text as service_key;
END;
$$;

-- Update the cleanup function to call the Edge Function immediately
CREATE OR REPLACE FUNCTION public.cleanup_post_media_assets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  media_url TEXT;
  thumbnail_key TEXT;
  media_key TEXT;
  deleted_count INTEGER := 0;
  supabase_config RECORD;
  http_response RECORD;
  cleanup_url TEXT;
BEGIN
  -- Log the cleanup operation
  RAISE LOG 'Starting media cleanup for deleted post: %', OLD.id;
  
  -- Process thumbnail_url if exists
  IF OLD.thumbnail_url IS NOT NULL AND OLD.thumbnail_url != '' THEN
    thumbnail_key := extract_r2_key_from_url(OLD.thumbnail_url);
    
    IF thumbnail_key IS NOT NULL THEN
      -- Mark thumbnail as deleted in media_assets
      UPDATE public.media_assets 
      SET deleted_at = now()
      WHERE r2_key = thumbnail_key 
        AND workspace_id = OLD.workspace_id 
        AND deleted_at IS NULL;
      
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RAISE LOG 'Marked thumbnail as deleted: % (rows affected: %)', thumbnail_key, deleted_count;
    END IF;
  END IF;
  
  -- Process each media_url if exists
  IF OLD.media_urls IS NOT NULL AND array_length(OLD.media_urls, 1) > 0 THEN
    FOREACH media_url IN ARRAY OLD.media_urls
    LOOP
      IF media_url IS NOT NULL AND media_url != '' THEN
        media_key := extract_r2_key_from_url(media_url);
        
        IF media_key IS NOT NULL THEN
          -- Mark media as deleted in media_assets
          UPDATE public.media_assets 
          SET deleted_at = now()
          WHERE r2_key = media_key 
            AND workspace_id = OLD.workspace_id 
            AND deleted_at IS NULL;
          
          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          RAISE LOG 'Marked media as deleted: % (rows affected: %)', media_key, deleted_count;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  -- Get Supabase configuration
  SELECT * INTO supabase_config FROM get_supabase_config();
  
  -- Construct cleanup URL
  cleanup_url := supabase_config.url || '/functions/v1/cleanup-deleted-media';
  
  -- Call the cleanup Edge Function immediately
  BEGIN
    SELECT * INTO http_response FROM http((
      'POST',
      cleanup_url,
      ARRAY[
        http_header('Authorization', 'Bearer ' || supabase_config.service_key),
        http_header('Content-Type', 'application/json')
      ],
      'application/json',
      '{}'
    ));
    
    RAISE LOG 'Called cleanup function, response status: %', http_response.status;
    
    IF http_response.status BETWEEN 200 AND 299 THEN
      RAISE LOG 'Media cleanup function executed successfully for post: %', OLD.id;
    ELSE
      RAISE LOG 'Media cleanup function returned error status % for post: %', http_response.status, OLD.id;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE LOG 'Failed to call cleanup function for post %: %', OLD.id, SQLERRM;
  END;
  
  RAISE LOG 'Completed media cleanup for post: %', OLD.id;
  RETURN OLD;
END;
$function$;