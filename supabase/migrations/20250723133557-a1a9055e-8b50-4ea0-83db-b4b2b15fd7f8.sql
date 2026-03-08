-- Corrigir a política RLS para criação de workspaces
-- Remover a validação circular do owner_id e focar apenas na verificação do role admin

DROP POLICY IF EXISTS "Authenticated admin users can create workspaces" ON public.workspaces;

CREATE POLICY "Only admin users can create workspaces" 
ON public.workspaces 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
);