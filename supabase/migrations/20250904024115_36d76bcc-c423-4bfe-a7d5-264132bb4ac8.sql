-- Fix extract_r2_key_from_url function to handle URLs without protocol correctly
CREATE OR REPLACE FUNCTION public.extract_r2_key_from_url(media_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Extract the key from R2 URL patterns
  -- Example: https://media.21m.space/workspaces/xxx/media/filename.ext
  -- or https://pub-xxx.r2.dev/workspaces/xxx/media/filename.ext
  -- or media.21m.space/workspaces/xxx/media/filename.ext (without protocol)
  
  IF media_url IS NULL OR media_url = '' THEN
    RETURN NULL;
  END IF;
  
  -- Handle custom domain URLs (media.21m.space) with or without protocol
  IF media_url LIKE '%media.21m.space%' THEN
    RETURN SUBSTRING(media_url FROM '(?:https?://)?media\.21m\.space/(.+)$');
  END IF;
  
  -- Handle R2.dev URLs with or without protocol  
  IF media_url LIKE '%.r2.dev%' THEN
    RETURN SUBSTRING(media_url FROM '(?:https?://)?[^/]*\.r2\.dev/(.+)$');
  END IF;
  
  -- If no pattern matches, try to extract everything after the domain
  RETURN SUBSTRING(media_url FROM '(?:https?://)?[^/]+/(.+)$');
END;
$$;