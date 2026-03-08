-- Primeiro, remover as constraints de foreign key temporariamente
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey;
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_user_id_fkey;
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_invited_by_fkey;

-- Atualizar workspaces para usar auth.users.id como owner_id
UPDATE public.workspaces 
SET owner_id = (
  SELECT p.user_id 
  FROM public.profiles p 
  WHERE p.id = workspaces.owner_id
)
WHERE owner_id IN (
  SELECT id FROM public.profiles
);

-- Atualizar workspace_members para usar auth.users.id como user_id
UPDATE public.workspace_members 
SET user_id = (
  SELECT p.user_id 
  FROM public.profiles p 
  WHERE p.id = workspace_members.user_id
)
WHERE user_id IN (
  SELECT id FROM public.profiles
);

-- Atualizar workspace_members para usar auth.users.id como invited_by
UPDATE public.workspace_members 
SET invited_by = (
  SELECT p.user_id 
  FROM public.profiles p 
  WHERE p.id = workspace_members.invited_by
)
WHERE invited_by IS NOT NULL 
AND invited_by IN (
  SELECT id FROM public.profiles
);

-- Recriar as foreign key constraints corretas para auth.users
ALTER TABLE public.workspaces 
ADD CONSTRAINT workspaces_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.workspace_members 
ADD CONSTRAINT workspace_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.workspace_members 
ADD CONSTRAINT workspace_members_invited_by_fkey 
FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;