-- Fix cleanup_post_media_assets function to remove legacy thumbnail_url reference
CREATE OR REPLACE FUNCTION public.cleanup_post_media_assets()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  media_url TEXT;
  thumbnail_url TEXT;
  thumbnail_key TEXT;
  media_key TEXT;
  deleted_count INTEGER := 0;
BEGIN
  -- Log the cleanup operation
  RAISE LOG 'Starting media cleanup for deleted post: %', OLD.id;
  
  -- Process thumbnail_urls array if exists
  IF OLD.thumbnail_urls IS NOT NULL AND array_length(OLD.thumbnail_urls, 1) > 0 THEN
    FOREACH thumbnail_url IN ARRAY OLD.thumbnail_urls
    LOOP
      IF thumbnail_url IS NOT NULL AND thumbnail_url != '' THEN
        thumbnail_key := extract_r2_key_from_url(thumbnail_url);
        
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
    END LOOP;
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
  
  RAISE LOG 'Completed media cleanup for post: % (marked for deletion only)', OLD.id;
  RETURN OLD;
END;
$function$;