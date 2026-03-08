-- Add thumbnail_url column to posts table for storing video thumbnails
ALTER TABLE public.posts ADD COLUMN thumbnail_url TEXT;