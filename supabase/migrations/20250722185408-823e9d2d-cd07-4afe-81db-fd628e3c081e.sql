-- Corrigir as políticas RLS para permitir que usuários admin criem workspaces
-- O problema está na verificação do user_id vs auth.uid()

-- Recriar a função is_user_admin para usar auth.uid() diretamente
CREATE OR REPLACE FUNCTION public.is_user_admin(user_uuid uuid DEFAULT auth.uid())
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

-- Dropar e recriar a política de INSERT para workspaces com a correção
DROP POLICY IF EXISTS "Only admins can create workspaces" ON public.workspaces;

CREATE POLICY "Only admins can create workspaces" 
ON public.workspaces 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  public.is_user_admin() AND 
  owner_id = auth.uid()
);

-- Garantir que a política de UPDATE também funcione corretamente
DROP POLICY IF EXISTS "Workspace owners and admins can update workspaces" ON public.workspaces;

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