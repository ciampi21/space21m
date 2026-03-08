-- Corrigir o problema de autenticação nas políticas RLS
-- O problema é que auth.uid() não está funcionando corretamente no contexto atual

-- Primeiro, vamos verificar se a função is_user_admin está funcionando corretamente
-- Vamos simplificar a abordagem e usar uma política mais direta

-- Dropar a política atual de INSERT
DROP POLICY IF EXISTS "Only admins can create workspaces" ON public.workspaces;

-- Criar uma nova política mais simples que verifica diretamente na tabela profiles
CREATE POLICY "Authenticated admin users can create workspaces" 
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

-- Também vamos corrigir a política de UPDATE que tem um erro na referência
DROP POLICY IF EXISTS "Workspace owners and admins can update workspaces" ON public.workspaces;

CREATE POLICY "Workspace owners and admins can update workspaces" 
ON public.workspaces 
FOR UPDATE 
USING (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = workspaces.id AND user_id = auth.uid() AND role = 'admin'
  )
);