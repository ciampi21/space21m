-- Add policy to allow service role to insert members for invitation acceptance
CREATE POLICY "Service role can insert workspace members for invitations" 
ON public.workspace_members 
FOR INSERT 
WITH CHECK (current_setting('role') = 'service_role');