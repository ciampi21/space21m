-- Update media_urls column to handle array of media URLs properly
ALTER TABLE public.posts 
ALTER COLUMN media_urls TYPE TEXT[] USING 
  CASE 
    WHEN media_urls IS NULL THEN NULL::TEXT[]
    ELSE string_to_array(media_urls::text, ',')
  END;