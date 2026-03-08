-- First, let's check if the trigger exists and create it if missing
-- Create trigger to automatically add workspace owner as admin member
DROP TRIGGER IF EXISTS add_workspace_owner_trigger ON public.workspaces;

CREATE TRIGGER add_workspace_owner_trigger
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.add_owner_as_workspace_member();

-- Let's also check what might be causing the duplicate insertion
-- by looking at the workspace_members table structure
SELECT schemaname, tablename, indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'workspace_members';