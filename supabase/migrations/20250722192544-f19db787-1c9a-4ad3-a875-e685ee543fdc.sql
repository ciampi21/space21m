
-- Corrigir a estrutura das tabelas workspaces e workspace_members
-- para referenciar diretamente auth.users em vez de profiles

-- 1. Alterar a tabela workspaces para referenciar auth.users diretamente
ALTER TABLE public.workspaces 
DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey;

ALTER TABLE public.workspaces
ADD CONSTRAINT workspaces_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Alterar a tabela workspace_members para referenciar auth.users diretamente
ALTER TABLE public.workspace_members 
DROP CONSTRAINT IF EXISTS workspace_members_user_id_fkey,
DROP CONSTRAINT IF EXISTS workspace_members_invited_by_fkey;

ALTER TABLE public.workspace_members
ADD CONSTRAINT workspace_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
ADD CONSTRAINT workspace_members_invited_by_fkey 
FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Migrar dados existentes dos workspaces para usar user_id correto
UPDATE public.workspaces 
SET owner_id = p.user_id 
FROM public.profiles p 
WHERE workspaces.owner_id = p.id;

-- 4. Migrar dados existentes dos workspace_members para usar user_id correto
UPDATE public.workspace_members 
SET user_id = p.user_id 
FROM public.profiles p 
WHERE workspace_members.user_id = p.id;

UPDATE public.workspace_members 
SET invited_by = p.user_id 
FROM public.profiles p 
WHERE workspace_members.invited_by = p.id AND workspace_members.invited_by IS NOT NULL;

-- 5. Atualizar a tabela posts para referenciar auth.users diretamente
ALTER TABLE public.posts 
DROP CONSTRAINT IF EXISTS posts_created_by_fkey;

ALTER TABLE public.posts
ADD CONSTRAINT posts_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrar dados dos posts
UPDATE public.posts 
SET created_by = p.user_id 
FROM public.profiles p 
WHERE posts.created_by = p.id;

-- 6. Atualizar a tabela post_comments para referenciar auth.users diretamente
ALTER TABLE public.post_comments 
DROP CONSTRAINT IF EXISTS post_comments_user_id_fkey;

ALTER TABLE public.post_comments
ADD CONSTRAINT post_comments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrar dados dos post_comments
UPDATE public.post_comments 
SET user_id = p.user_id 
FROM public.profiles p 
WHERE post_comments.user_id = p.id;

-- 7. Atualizar a tabela invitations para referenciar auth.users diretamente
ALTER TABLE public.invitations 
DROP CONSTRAINT IF EXISTS invitations_invited_by_fkey;

ALTER TABLE public.invitations
ADD CONSTRAINT invitations_invited_by_fkey 
FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrar dados das invitations
UPDATE public.invitations 
SET invited_by = p.user_id 
FROM public.profiles p 
WHERE invitations.invited_by = p.id;

-- 8. Recriar as funções helper com a nova estrutura
CREATE OR REPLACE FUNCTION public.user_belongs_to_workspace(user_uuid uuid, workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = workspace_uuid AND owner_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = workspace_uuid AND user_id = user_uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace_members(user_uuid uuid, workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = workspace_uuid AND owner_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = workspace_uuid AND user_id = user_uuid AND role = 'admin'
  );
$$;

-- 9. Dropar e recriar todas as políticas RLS com a estrutura corrigida

-- Políticas para workspaces
DROP POLICY IF EXISTS "Authenticated admin users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON public.workspaces;
DROP POLICY IF EXISTS "Workspace owners and admins can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Only owners can delete workspaces" ON public.workspaces;

CREATE POLICY "Only admins can create workspaces" 
ON public.workspaces 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) AND
  owner_id = auth.uid()
);

CREATE POLICY "Users can view workspaces they belong to" 
ON public.workspaces 
FOR SELECT 
USING (public.user_belongs_to_workspace(auth.uid(), id));

CREATE POLICY "Workspace owners and admins can update workspaces" 
ON public.workspaces 
FOR UPDATE 
USING (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = id AND user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Only owners can delete workspaces" 
ON public.workspaces 
FOR DELETE 
USING (owner_id = auth.uid());

-- Políticas para workspace_members
DROP POLICY IF EXISTS "Users can view workspace members where they belong" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace admins can update members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace admins can remove members" ON public.workspace_members;

CREATE POLICY "Users can view workspace members where they belong" 
ON public.workspace_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  public.can_manage_workspace_members(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace admins can manage members" 
ON public.workspace_members 
FOR INSERT 
WITH CHECK (public.can_manage_workspace_members(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can update members" 
ON public.workspace_members 
FOR UPDATE 
USING (public.can_manage_workspace_members(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can remove members" 
ON public.workspace_members 
FOR DELETE 
USING (public.can_manage_workspace_members(auth.uid(), workspace_id));

-- Políticas para posts
DROP POLICY IF EXISTS "Users can view posts in their workspaces" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts in their workspaces" ON public.posts;
DROP POLICY IF EXISTS "Users can update posts in their workspaces" ON public.posts;

CREATE POLICY "Users can view posts in their workspaces" 
ON public.posts 
FOR SELECT 
USING (public.user_belongs_to_workspace(auth.uid(), workspace_id));

CREATE POLICY "Users can create posts in their workspaces" 
ON public.posts 
FOR INSERT 
WITH CHECK (public.user_belongs_to_workspace(auth.uid(), workspace_id));

CREATE POLICY "Users can update posts in their workspaces" 
ON public.posts 
FOR UPDATE 
USING (public.user_belongs_to_workspace(auth.uid(), workspace_id));

CREATE POLICY "Users can delete posts in their workspaces" 
ON public.posts 
FOR DELETE 
USING (public.user_belongs_to_workspace(auth.uid(), workspace_id));

-- Políticas para post_comments
DROP POLICY IF EXISTS "Users can view comments on posts in their workspaces" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create comments on posts in their workspaces" ON public.post_comments;

CREATE POLICY "Users can view comments on posts in their workspaces" 
ON public.post_comments 
FOR SELECT 
USING (
  post_id IN (
    SELECT id FROM public.posts 
    WHERE public.user_belongs_to_workspace(auth.uid(), workspace_id)
  )
);

CREATE POLICY "Users can create comments on posts in their workspaces" 
ON public.post_comments 
FOR INSERT 
WITH CHECK (
  post_id IN (
    SELECT id FROM public.posts 
    WHERE public.user_belongs_to_workspace(auth.uid(), workspace_id)
  )
);

-- Políticas para invitations
DROP POLICY IF EXISTS "Users can view invitations they sent" ON public.invitations;
DROP POLICY IF EXISTS "Users can create invitations for their workspaces" ON public.invitations;

CREATE POLICY "Users can view invitations they sent" 
ON public.invitations 
FOR SELECT 
USING (invited_by = auth.uid());

CREATE POLICY "Users can create invitations for their workspaces" 
ON public.invitations 
FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT id FROM public.workspaces 
    WHERE owner_id = auth.uid()
  )
);
