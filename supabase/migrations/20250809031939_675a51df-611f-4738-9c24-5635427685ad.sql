-- Allow workspace admins/owners to revoke pending invitations
CREATE POLICY IF NOT EXISTS "Workspace admins can delete invitations"
ON public.invitations
FOR DELETE
USING (can_manage_workspace_members(auth.uid(), workspace_id));
