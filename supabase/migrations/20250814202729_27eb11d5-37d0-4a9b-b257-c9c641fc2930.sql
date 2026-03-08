-- Rename column from role_in_workspace to role in workspace_members table
ALTER TABLE public.workspace_members RENAME COLUMN role_in_workspace TO role;

-- Update existing roles: change 'admin' to 'owner' for workspace owners
UPDATE public.workspace_members 
SET role = 'owner' 
WHERE role = 'admin' 
AND user_id IN (
  SELECT owner_id FROM public.workspaces 
  WHERE workspaces.id = workspace_members.workspace_id
);

-- Update the trigger function to use 'owner' instead of 'admin'
CREATE OR REPLACE FUNCTION public.add_owner_as_workspace_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Add workspace owner as owner member with conflict handling
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by, invited_at)
  VALUES (NEW.id, NEW.owner_id, 'owner', NEW.owner_id, NOW())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- Update RLS policies to use the new column name and role
DROP POLICY IF EXISTS "Workspace owners and admins can update workspaces" ON public.workspaces;

CREATE POLICY "Workspace owners and members can update workspaces"
ON public.workspaces
FOR UPDATE 
USING (
  (owner_id = auth.uid()) OR 
  (EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_members.workspace_id = workspaces.id 
    AND workspace_members.user_id = auth.uid() 
    AND workspace_members.role IN ('owner', 'admin')
  ))
);

-- Update the can_manage_workspace_members function to use new role
CREATE OR REPLACE FUNCTION public.can_manage_workspace_members(user_uuid uuid, workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = workspace_uuid AND owner_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = workspace_uuid AND user_id = user_uuid AND role IN ('owner', 'admin')
  );
$function$;