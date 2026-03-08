-- Create trigger to recalculate owner storage when workspace is deleted
CREATE OR REPLACE FUNCTION public.recalculate_owner_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_storage_mb INTEGER := 0;
BEGIN
  -- Calculate total storage for the workspace owner
  SELECT COALESCE(SUM(
    COALESCE(ma.size_bytes, 0) / (1024 * 1024)
  ), 0) INTO total_storage_mb
  FROM media_assets ma
  INNER JOIN workspaces w ON ma.workspace_id = w.id
  WHERE w.owner_id = OLD.owner_id
    AND ma.deleted_at IS NULL;
  
  -- Update the owner's profile with correct storage
  UPDATE public.profiles 
  SET storage_used_mb = total_storage_mb,
      updated_at = now()
  WHERE user_id = OLD.owner_id;
  
  RAISE LOG 'Recalculated storage for user %: % MB', OLD.owner_id, total_storage_mb;
  
  RETURN OLD;
END;
$$;

-- Create trigger for workspace deletion
CREATE OR REPLACE TRIGGER recalculate_storage_on_workspace_delete
AFTER DELETE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_owner_storage();

-- Immediate correction: Update storage for users with 0 workspaces
UPDATE public.profiles 
SET storage_used_mb = 0, updated_at = now()
WHERE user_id IN (
  SELECT p.user_id 
  FROM profiles p 
  LEFT JOIN workspaces w ON w.owner_id = p.user_id 
  WHERE w.id IS NULL AND p.storage_used_mb > 0
);

-- Log the correction
INSERT INTO admin_audit_log (
  admin_user_id,
  action_type, 
  target_resource,
  target_id,
  details
) 
SELECT 
  '00000000-0000-0000-0000-000000000000'::uuid,
  'STORAGE_CORRECTION',
  'profiles',
  user_id,
  jsonb_build_object(
    'reason', 'Corrected storage for users with no workspaces',
    'timestamp', now()
  )
FROM profiles 
WHERE user_id IN (
  SELECT p.user_id 
  FROM profiles p 
  LEFT JOIN workspaces w ON w.owner_id = p.user_id 
  WHERE w.id IS NULL AND p.storage_used_mb > 0
);