-- Create follower_stats table for tracking follower growth
CREATE TABLE public.follower_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  follower_count INTEGER NOT NULL CHECK (follower_count >= 0),
  week_start_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  CONSTRAINT unique_platform_week UNIQUE (workspace_id, platform, username, week_start_date)
);

-- Enable Row Level Security
ALTER TABLE public.follower_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for follower_stats
CREATE POLICY "Users can view follower stats in their workspaces" 
ON public.follower_stats 
FOR SELECT 
USING (workspace_id IN (
  SELECT w.id FROM workspaces w 
  WHERE w.owner_id = auth.uid() 
  OR w.id IN (
    SELECT wm.workspace_id FROM workspace_members wm 
    WHERE wm.user_id = auth.uid()
  )
));

CREATE POLICY "Users can create follower stats in their workspaces" 
ON public.follower_stats 
FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT w.id FROM workspaces w 
    WHERE w.owner_id = auth.uid() 
    OR w.id IN (
      SELECT wm.workspace_id FROM workspace_members wm 
      WHERE wm.user_id = auth.uid()
    )
  ) AND created_by = auth.uid()
);

CREATE POLICY "Users can update follower stats in their workspaces" 
ON public.follower_stats 
FOR UPDATE 
USING (workspace_id IN (
  SELECT w.id FROM workspaces w 
  WHERE w.owner_id = auth.uid() 
  OR w.id IN (
    SELECT wm.workspace_id FROM workspace_members wm 
    WHERE wm.user_id = auth.uid()
  )
));

CREATE POLICY "Users can delete follower stats in their workspaces" 
ON public.follower_stats 
FOR DELETE 
USING (workspace_id IN (
  SELECT w.id FROM workspaces w 
  WHERE w.owner_id = auth.uid() 
  OR w.id IN (
    SELECT wm.workspace_id FROM workspace_members wm 
    WHERE wm.user_id = auth.uid()
  )
));