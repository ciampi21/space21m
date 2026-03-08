-- Create secure RPC function to get workspace members with only safe fields
-- This prevents exposure of sensitive data like stripe_customer_id, signup_ip, utm_* etc.

CREATE OR REPLACE FUNCTION public.get_workspace_members_safe(workspace_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  username TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user belongs to workspace
  IF NOT user_belongs_to_workspace(auth.uid(), workspace_uuid) THEN
    RAISE EXCEPTION 'Access denied: user does not belong to workspace';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.email, p.username
  FROM profiles p
  WHERE p.user_id IN (
    SELECT w.owner_id FROM workspaces w WHERE w.id = workspace_uuid
    UNION
    SELECT wm.user_id FROM workspace_members wm WHERE wm.workspace_id = workspace_uuid
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_workspace_members_safe(UUID) TO authenticated;

-- Drop the problematic RLS policy that exposes all profile fields to workspace members
DROP POLICY IF EXISTS "Workspace members can view each other's basic profiles" ON profiles;