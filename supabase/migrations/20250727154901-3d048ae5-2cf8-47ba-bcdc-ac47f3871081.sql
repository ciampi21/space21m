-- Add DELETE policy for posts table to allow users to delete posts in their workspaces
CREATE POLICY "Users can delete posts in their workspaces" 
ON public.posts 
FOR DELETE 
USING (workspace_id IN ( 
  SELECT workspaces.id
  FROM workspaces
  WHERE ((workspaces.owner_id = auth.uid()) OR (workspaces.id IN ( 
    SELECT workspace_members.workspace_id
    FROM workspace_members
    WHERE (workspace_members.user_id = auth.uid()))
  ))
));