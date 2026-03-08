-- Fix the 2 problematic posts stuck in Uploading status
UPDATE public.posts 
SET 
  status = 'Pendente',
  media_urls = ARRAY[]::text[],
  additional_comments = 'Upload anterior falhou. Por favor, tente fazer upload novamente.'
WHERE id IN (
  '7895d57e-f35d-4410-b378-175ed9a65e00',
  '9c9d64c7-7b3f-440d-a841-18a1c3cce767'
)
AND status = 'Uploading';

-- Create function to cleanup stuck uploads automatically
CREATE OR REPLACE FUNCTION public.cleanup_stuck_uploads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Find posts stuck in Uploading status for more than 10 minutes
  UPDATE public.posts 
  SET 
    status = 'Erro',
    additional_comments = COALESCE(
      additional_comments || E'\n\n',
      ''
    ) || 'Upload automático falhou após timeout. Por favor, tente novamente.',
    updated_at = now()
  WHERE status = 'Uploading'
    AND updated_at < (now() - INTERVAL '10 minutes')
    AND (media_urls IS NULL OR array_length(media_urls, 1) = 0);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE LOG 'Cleaned up % stuck uploads', updated_count;
  
  RETURN updated_count;
END;
$$;