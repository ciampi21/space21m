-- Fix status of posts with failed uploads that were incorrectly set to 'Pendente'
-- These posts have empty media_urls and comments about upload failure

UPDATE public.posts 
SET 
  status = 'Erro',
  updated_at = now()
WHERE id IN (
  '7895d57e-f35d-4410-b378-175ed9a65e00',
  '9c9d64c7-7b3f-440d-a841-18a1c3cce767'
)
AND status = 'Pendente'
AND (media_urls IS NULL OR array_length(media_urls, 1) = 0);