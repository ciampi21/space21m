-- Remover o enum app_role da tabela workspace_members e converter para text
ALTER TABLE public.workspace_members 
ALTER COLUMN role TYPE text USING role::text,
ALTER COLUMN role SET DEFAULT 'guest';

-- Remover o enum app_role
DROP TYPE IF EXISTS public.app_role;