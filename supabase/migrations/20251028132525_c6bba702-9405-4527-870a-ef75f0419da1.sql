-- Create table for Instagram connected accounts
CREATE TABLE public.instagram_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  instagram_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'bearer',
  expires_at TIMESTAMP WITH TIME ZONE,
  account_type TEXT CHECK (account_type IN ('BUSINESS', 'CREATOR', 'PERSONAL')),
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, instagram_user_id)
);

-- Enable RLS
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view Instagram accounts in their workspaces
CREATE POLICY "Users can view Instagram accounts in their workspaces"
ON public.instagram_accounts
FOR SELECT
USING (
  workspace_id IN (
    SELECT w.id FROM workspaces w
    WHERE w.owner_id = auth.uid()
    OR w.id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  )
);

-- Policy: Users can insert Instagram accounts in their workspaces
CREATE POLICY "Users can insert Instagram accounts in their workspaces"
ON public.instagram_accounts
FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT w.id FROM workspaces w
    WHERE w.owner_id = auth.uid()
    OR w.id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  )
);

-- Policy: Users can update Instagram accounts in their workspaces
CREATE POLICY "Users can update Instagram accounts in their workspaces"
ON public.instagram_accounts
FOR UPDATE
USING (
  workspace_id IN (
    SELECT w.id FROM workspaces w
    WHERE w.owner_id = auth.uid()
    OR w.id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  )
);

-- Policy: Users can delete Instagram accounts in their workspaces
CREATE POLICY "Users can delete Instagram accounts in their workspaces"
ON public.instagram_accounts
FOR DELETE
USING (
  workspace_id IN (
    SELECT w.id FROM workspaces w
    WHERE w.owner_id = auth.uid()
    OR w.id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_instagram_accounts_updated_at
BEFORE UPDATE ON public.instagram_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();