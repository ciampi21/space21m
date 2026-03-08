-- Allow workspace members to view basic profile information of other members in the same workspace
CREATE POLICY "Workspace members can view each other's basic profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    -- Users can see their own profile
    user_id = auth.uid() OR
    -- Users can see profiles of other members in workspaces they belong to
    user_id IN (
      SELECT DISTINCT wm.user_id
      FROM workspace_members wm
      WHERE wm.workspace_id IN (
        -- Get all workspaces the current user belongs to
        SELECT w.id
        FROM workspaces w
        WHERE w.owner_id = auth.uid()
        UNION
        SELECT wm2.workspace_id
        FROM workspace_members wm2
        WHERE wm2.user_id = auth.uid()
      )
    ) OR
    -- Users can see profiles of workspace owners for workspaces they belong to
    user_id IN (
      SELECT DISTINCT w.owner_id
      FROM workspaces w
      WHERE w.id IN (
        SELECT wm3.workspace_id
        FROM workspace_members wm3
        WHERE wm3.user_id = auth.uid()
      )
    )
  )
);