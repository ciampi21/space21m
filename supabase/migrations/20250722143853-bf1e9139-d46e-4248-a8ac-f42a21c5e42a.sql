-- Corrigir as RLS policies para usar user_id em vez do campo id que não existe

-- Dropar e recriar policies da tabela workspaces
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON public.workspaces;
DROP POLICY IF EXISTS "Workspace owners can update their workspaces" ON public.workspaces;

-- Policies para workspaces
CREATE POLICY "Authenticated users can create workspaces" 
ON public.workspaces 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view workspaces they belong to" 
ON public.workspaces 
FOR SELECT 
USING (
  owner_id = auth.uid() OR 
  id IN (
    SELECT workspace_members.workspace_id 
    FROM workspace_members 
    WHERE workspace_members.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owners can update their workspaces" 
ON public.workspaces 
FOR UPDATE 
USING (owner_id = auth.uid());

-- Dropar e recriar policies da tabela workspace_members
DROP POLICY IF EXISTS "Users can view workspace members for their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON public.workspace_members;

-- Policies para workspace_members
CREATE POLICY "Users can view workspace members for their workspaces" 
ON public.workspace_members 
FOR SELECT 
USING (
  workspace_id IN (
    SELECT workspaces.id 
    FROM workspaces 
    WHERE owner_id = auth.uid() OR 
    workspaces.id IN (
      SELECT workspace_members.workspace_id 
      FROM workspace_members 
      WHERE workspace_members.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Workspace admins can manage members" 
ON public.workspace_members 
FOR ALL 
USING (
  workspace_id IN (
    SELECT workspaces.id 
    FROM workspaces 
    WHERE owner_id = auth.uid()
  )
);

-- Corrigir políticas de posts também
DROP POLICY IF EXISTS "Users can view posts in their workspaces" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts in their workspaces" ON public.posts;
DROP POLICY IF EXISTS "Users can update posts in their workspaces" ON public.posts;

CREATE POLICY "Users can view posts in their workspaces" 
ON public.posts 
FOR SELECT 
USING (
  workspace_id IN (
    SELECT workspaces.id 
    FROM workspaces 
    WHERE owner_id = auth.uid() OR 
    workspaces.id IN (
      SELECT workspace_members.workspace_id 
      FROM workspace_members 
      WHERE workspace_members.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create posts in their workspaces" 
ON public.posts 
FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT workspaces.id 
    FROM workspaces 
    WHERE owner_id = auth.uid() OR 
    workspaces.id IN (
      SELECT workspace_members.workspace_id 
      FROM workspace_members 
      WHERE workspace_members.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update posts in their workspaces" 
ON public.posts 
FOR UPDATE 
USING (
  workspace_id IN (
    SELECT workspaces.id 
    FROM workspaces 
    WHERE owner_id = auth.uid() OR 
    workspaces.id IN (
      SELECT workspace_members.workspace_id 
      FROM workspace_members 
      WHERE workspace_members.user_id = auth.uid()
    )
  )
);