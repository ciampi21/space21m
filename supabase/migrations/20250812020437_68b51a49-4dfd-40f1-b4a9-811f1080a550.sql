-- Fix RLS to allow all workspace members to view the full members list
DROP POLICY IF EXISTS "Users can view workspace members where they belong" ON public.workspace_members;

CREATE POLICY "Users can view all members of their workspaces"
ON public.workspace_members
FOR SELECT
USING (user_belongs_to_workspace(auth.uid(), workspace_id));

-- Prevent duplicate profiles per auth user
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_user_id_unique'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;