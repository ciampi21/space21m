-- Create atomic function to append media URL to post
CREATE OR REPLACE FUNCTION public.append_media_url_to_post(
  target_post_id UUID,
  new_media_url TEXT
) 
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atomic update to append media URL without race conditions
  UPDATE public.posts 
  SET 
    media_urls = CASE 
      WHEN media_urls IS NULL THEN ARRAY[new_media_url]
      WHEN new_media_url = ANY(media_urls) THEN media_urls  -- Prevent duplicates
      ELSE array_append(media_urls, new_media_url)
    END,
    status = 'Pendente',
    updated_at = now()
  WHERE id = target_post_id;
  
  -- Log the operation
  RAISE LOG 'Added media URL to post %: %', target_post_id, new_media_url;
END;
$$;