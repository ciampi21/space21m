-- Clean up any existing duplicate triggers and create a single working trigger
-- First, drop all existing triggers on workspaces table
DROP TRIGGER IF EXISTS add_owner_as_workspace_member_trigger ON public.workspaces;
DROP TRIGGER IF EXISTS add_workspace_owner_trigger ON public.workspaces;
DROP TRIGGER IF EXISTS add_owner_as_member_trigger ON public.workspaces;
DROP TRIGGER IF EXISTS add_owner_as_member ON public.workspaces;

-- Update the function to handle conflicts gracefully
CREATE OR REPLACE FUNCTION public.add_owner_as_workspace_member()
RETURNS TRIGGER AS $$
BEGIN
  -- Add workspace owner as admin member with conflict handling
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by, invited_at)
  VALUES (NEW.id, NEW.owner_id, 'admin', NEW.owner_id, NOW())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Create a single, properly named trigger
CREATE TRIGGER workspace_owner_member_trigger
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.add_owner_as_workspace_member();