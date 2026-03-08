-- Create function to check if user is workspace owner
CREATE OR REPLACE FUNCTION public.is_workspace_owner(user_uuid uuid, workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = workspace_uuid AND owner_id = user_uuid
  );
$$;

-- Update RLS policy for posts to restrict draft access to owners only
DROP POLICY IF EXISTS "Users can view posts in their workspaces" ON public.posts;

CREATE POLICY "Users can view posts in their workspaces" 
ON public.posts 
FOR SELECT 
USING (
  workspace_id IN (
    SELECT workspaces.id
    FROM workspaces
    WHERE (
      workspaces.owner_id = auth.uid() 
      OR workspaces.id IN (
        SELECT workspace_members.workspace_id
        FROM workspace_members
        WHERE workspace_members.user_id = auth.uid()
      )
    )
  )
  AND (
    -- If it's a draft, only workspace owner can see it
    status != 'Rascunho' 
    OR is_workspace_owner(auth.uid(), workspace_id)
  )
);

-- Update RLS policy for posts creation to allow drafts only for owners
DROP POLICY IF EXISTS "Users can create posts in their workspaces" ON public.posts;

CREATE POLICY "Users can create posts in their workspaces" 
ON public.posts 
FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT workspaces.id
    FROM workspaces
    WHERE (
      workspaces.owner_id = auth.uid() 
      OR workspaces.id IN (
        SELECT workspace_members.workspace_id
        FROM workspace_members
        WHERE workspace_members.user_id = auth.uid()
      )
    )
  )
  AND (
    -- If it's a draft, only workspace owner can create it
    status != 'Rascunho' 
    OR is_workspace_owner(auth.uid(), workspace_id)
  )
);