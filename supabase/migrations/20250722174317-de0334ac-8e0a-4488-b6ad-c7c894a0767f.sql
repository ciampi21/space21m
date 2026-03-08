-- Corrigir recursão infinita nas políticas de workspaces e workspace_members
-- Criar funções helper para evitar referências circulares

-- Função para verificar se um usuário é admin no profiles
CREATE OR REPLACE FUNCTION public.is_user_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid AND role = 'admin'
  );
$$;

-- Função para verificar se um usuário pertence a um workspace (como owner ou membro)
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

-- Função para verificar se um usuário pode gerenciar membros de um workspace
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

-- Função para adicionar automaticamente o owner como membro admin do workspace
CREATE OR REPLACE FUNCTION public.add_owner_as_workspace_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by, invited_at)
  VALUES (NEW.id, NEW.owner_id, 'admin', NEW.owner_id, NOW());
  RETURN NEW;
END;
$$;

-- Dropar todas as políticas existentes das tabelas workspaces e workspace_members
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON public.workspaces;
DROP POLICY IF EXISTS "Workspace owners can update their workspaces" ON public.workspaces;

DROP POLICY IF EXISTS "Users can view workspace members for their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON public.workspace_members;

-- Criar novas políticas para workspaces sem recursão
CREATE POLICY "Only admins can create workspaces" 
ON public.workspaces 
FOR INSERT 
WITH CHECK (public.is_user_admin(auth.uid()));

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

-- Criar novas políticas para workspace_members sem recursão
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

-- Criar trigger para adicionar automaticamente o owner como membro admin
DROP TRIGGER IF EXISTS add_owner_as_member ON public.workspaces;
CREATE TRIGGER add_owner_as_member
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.add_owner_as_workspace_member();