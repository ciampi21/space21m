-- Remove the unused thumbnail_url column from posts table
-- We now use thumbnail_urls array instead
ALTER TABLE public.posts DROP COLUMN IF EXISTS thumbnail_url;