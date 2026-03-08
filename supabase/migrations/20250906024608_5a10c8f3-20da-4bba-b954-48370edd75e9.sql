-- Step 1: Update existing data in profiles table (change 'guest' to 'user')
UPDATE public.profiles 
SET role = 'user' 
WHERE role = 'guest';

-- Step 2: Set default role to 'user' for profiles table
ALTER TABLE public.profiles 
ALTER COLUMN role SET DEFAULT 'user';

-- Step 3: Rename 'role' column to 'workspace_role' in workspace_members table
ALTER TABLE public.workspace_members 
RENAME COLUMN role TO workspace_role;

-- Step 4: Set default workspace_role to 'guest' for new members
ALTER TABLE public.workspace_members 
ALTER COLUMN workspace_role SET DEFAULT 'guest';

-- Step 5: Update any existing 'admin' workspace roles to 'guest' (since workspace only has owner/guest)
UPDATE public.workspace_members 
SET workspace_role = 'guest' 
WHERE workspace_role = 'admin';

-- Step 6: Update RLS policies that reference the old column name
-- First drop existing policies that reference 'role' in workspace_members
DROP POLICY IF EXISTS "Workspace admins can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace admins can remove members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace admins can update members" ON public.workspace_members;

-- Recreate policies with updated column name
CREATE POLICY "Workspace admins can manage members" 
ON public.workspace_members 
FOR INSERT 
WITH CHECK (can_manage_workspace_members(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can remove members" 
ON public.workspace_members 
FOR DELETE 
USING (can_manage_workspace_members(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can update members" 
ON public.workspace_members 
FOR UPDATE 
USING (can_manage_workspace_members(auth.uid(), workspace_id));

-- Step 7: Update any database functions that reference the old role structure
-- Update the can_manage_workspace_members function if it references the old column
CREATE OR REPLACE FUNCTION public.can_manage_workspace_members(user_uuid uuid, workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = workspace_uuid AND owner_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = workspace_uuid AND user_id = user_uuid AND workspace_role IN ('owner')
  );
$$;

-- Step 8: Update the add_owner_as_workspace_member function to use new column name
CREATE OR REPLACE FUNCTION public.add_owner_as_workspace_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Add workspace owner as owner member with conflict handling
  INSERT INTO public.workspace_members (workspace_id, user_id, workspace_role, invited_by, invited_at)
  VALUES (NEW.id, NEW.owner_id, 'owner', NEW.owner_id, NOW())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;