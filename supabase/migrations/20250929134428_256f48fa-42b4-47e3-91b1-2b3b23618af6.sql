-- Create a more robust delete function for debugging
CREATE OR REPLACE FUNCTION public.debug_post_deletion(target_post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  post_record RECORD;
  media_count INTEGER := 0;
  comment_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Get post details
  SELECT * INTO post_record FROM public.posts WHERE id = target_post_id;
  
  IF post_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Post not found',
      'post_id', target_post_id
    );
  END IF;
  
  -- Count related records
  SELECT COUNT(*) INTO comment_count FROM public.post_comments WHERE post_id = target_post_id;
  
  -- Check if user has permission (using RLS)
  IF NOT EXISTS (
    SELECT 1 FROM public.posts 
    WHERE id = target_post_id 
    AND workspace_id IN (
      SELECT w.id FROM workspaces w 
      WHERE w.owner_id = auth.uid() 
      OR w.id IN (
        SELECT wm.workspace_id FROM workspace_members wm 
        WHERE wm.user_id = auth.uid()
      )
    )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Permission denied',
      'post_id', target_post_id
    );
  END IF;
  
  -- Return debug info
  result := jsonb_build_object(
    'success', true,
    'post_id', target_post_id,
    'post_title', post_record.title,
    'post_status', post_record.status,
    'workspace_id', post_record.workspace_id,
    'created_by', post_record.created_by,
    'media_urls_count', COALESCE(array_length(post_record.media_urls, 1), 0),
    'thumbnail_urls_count', COALESCE(array_length(post_record.thumbnail_urls, 1), 0),
    'comment_count', comment_count,
    'can_delete', true
  );
  
  RETURN result;
END;
$$;