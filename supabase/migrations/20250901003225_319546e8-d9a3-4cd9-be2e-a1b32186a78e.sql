-- Add thumbnail_urls column to posts table for storing video thumbnail URLs
ALTER TABLE public.posts 
ADD COLUMN thumbnail_urls text[];

-- Add index for better performance on thumbnail_urls
CREATE INDEX IF NOT EXISTS idx_posts_thumbnail_urls ON public.posts USING GIN(thumbnail_urls);