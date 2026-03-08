-- Corrigir dados existentes para usar auth.users.id em vez de profiles.id

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

-- Atualizar workspace_members para user auth.users.id como invited_by 
UPDATE public.workspace_members 
SET invited_by = (
  SELECT p.user_id 
  FROM public.profiles p 
  WHERE p.id = workspace_members.invited_by
)
WHERE invited_by IN (
  SELECT id FROM public.profiles
);