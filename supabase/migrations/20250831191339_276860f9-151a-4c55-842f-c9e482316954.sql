-- Create function to extract R2 keys from media URLs
CREATE OR REPLACE FUNCTION public.extract_r2_key_from_url(media_url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Extract the key from R2 URL patterns
  -- Example: https://media.21m.space/workspaces/xxx/media/filename.ext
  -- or https://pub-xxx.r2.dev/workspaces/xxx/media/filename.ext
  
  IF media_url IS NULL OR media_url = '' THEN
    RETURN NULL;
  END IF;
  
  -- Handle custom domain URLs (media.21m.space)
  IF media_url LIKE '%media.21m.space%' THEN
    RETURN SUBSTRING(media_url FROM 'media\.21m\.space/(.+)$');
  END IF;
  
  -- Handle R2.dev URLs
  IF media_url LIKE '%.r2.dev%' THEN
    RETURN SUBSTRING(media_url FROM 'r2\.dev/(.+)$');
  END IF;
  
  -- If no pattern matches, try to extract everything after the domain
  RETURN SUBSTRING(media_url FROM '[^/]+//[^/]+/(.+)$');
END;
$$;

-- Create function to cleanup post media assets
CREATE OR REPLACE FUNCTION public.cleanup_post_media_assets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  media_url TEXT;
  thumbnail_key TEXT;
  media_key TEXT;
  deleted_count INTEGER := 0;
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
  
  RAISE LOG 'Completed media cleanup for post: %', OLD.id;
  RETURN OLD;
END;
$$;

-- Create trigger to automatically cleanup media when a post is deleted
DROP TRIGGER IF EXISTS trigger_cleanup_post_media ON public.posts;
CREATE TRIGGER trigger_cleanup_post_media
  AFTER DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_post_media_assets();

-- Create function to perform actual R2 deletion (to be called by edge function or cron)
CREATE OR REPLACE FUNCTION public.get_pending_media_deletions()
RETURNS TABLE (
  id UUID,
  r2_key TEXT,
  workspace_id UUID,
  deleted_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    ma.id,
    ma.r2_key,
    ma.workspace_id,
    ma.deleted_at
  FROM public.media_assets ma
  WHERE ma.deleted_at IS NOT NULL 
    AND ma.r2_key IS NOT NULL
    AND ma.deleted_at > (now() - INTERVAL '7 days') -- Only recent deletions
  ORDER BY ma.deleted_at DESC;
$$;