-- Create tables for historical analytics preservation

-- Monthly analytics aggregation table
CREATE TABLE public.monthly_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  total_posts INTEGER NOT NULL DEFAULT 0,
  approved_posts INTEGER NOT NULL DEFAULT 0,
  pending_posts INTEGER NOT NULL DEFAULT 0,
  rejected_posts INTEGER NOT NULL DEFAULT 0,
  scheduled_posts INTEGER NOT NULL DEFAULT 0,
  published_posts INTEGER NOT NULL DEFAULT 0,
  platform_distribution JSONB NOT NULL DEFAULT '{}',
  post_type_distribution JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  aggregated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, year, month)
);

-- Platform analytics aggregation table
CREATE TABLE public.platform_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  platform TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  published_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  aggregated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, platform, year, month)
);

-- Workspace analytics snapshots table
CREATE TABLE public.workspace_analytics_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  total_posts_lifetime INTEGER NOT NULL DEFAULT 0,
  total_storage_used_mb INTEGER NOT NULL DEFAULT 0,
  active_users_count INTEGER NOT NULL DEFAULT 0,
  posts_by_status JSONB NOT NULL DEFAULT '{}',
  posts_by_platform JSONB NOT NULL DEFAULT '{}',
  posts_by_type JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, snapshot_date)
);

-- Enable RLS on all tables
ALTER TABLE public.monthly_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies for monthly_analytics
CREATE POLICY "Users can view monthly analytics from their workspaces"
ON public.monthly_analytics
FOR SELECT
USING (workspace_id IN (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = auth.uid() OR w.id IN (
    SELECT wm.workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
));

CREATE POLICY "Users can insert monthly analytics in their workspaces"
ON public.monthly_analytics
FOR INSERT
WITH CHECK (workspace_id IN (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = auth.uid() OR w.id IN (
    SELECT wm.workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
) AND created_by = auth.uid());

-- RLS policies for platform_analytics
CREATE POLICY "Users can view platform analytics from their workspaces"
ON public.platform_analytics
FOR SELECT
USING (workspace_id IN (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = auth.uid() OR w.id IN (
    SELECT wm.workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
));

CREATE POLICY "Users can insert platform analytics in their workspaces"
ON public.platform_analytics
FOR INSERT
WITH CHECK (workspace_id IN (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = auth.uid() OR w.id IN (
    SELECT wm.workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
) AND created_by = auth.uid());

-- RLS policies for workspace_analytics_snapshots
CREATE POLICY "Users can view workspace snapshots from their workspaces"
ON public.workspace_analytics_snapshots
FOR SELECT
USING (workspace_id IN (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = auth.uid() OR w.id IN (
    SELECT wm.workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
));

CREATE POLICY "Users can insert workspace snapshots in their workspaces"
ON public.workspace_analytics_snapshots
FOR INSERT
WITH CHECK (workspace_id IN (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = auth.uid() OR w.id IN (
    SELECT wm.workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
) AND created_by = auth.uid());

-- Service role can manage all analytics tables
CREATE POLICY "Service role can manage monthly analytics"
ON public.monthly_analytics
FOR ALL
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "Service role can manage platform analytics"
ON public.platform_analytics
FOR ALL
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "Service role can manage workspace snapshots"
ON public.workspace_analytics_snapshots
FOR ALL
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- Create indexes for better performance
CREATE INDEX idx_monthly_analytics_workspace_date ON public.monthly_analytics(workspace_id, year, month);
CREATE INDEX idx_platform_analytics_workspace_date ON public.platform_analytics(workspace_id, year, month);
CREATE INDEX idx_workspace_snapshots_workspace_date ON public.workspace_analytics_snapshots(workspace_id, snapshot_date);

-- Create function to aggregate monthly analytics
CREATE OR REPLACE FUNCTION public.aggregate_monthly_analytics(target_workspace_id UUID, target_year INTEGER, target_month INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  workspace_owner_id UUID;
  total_posts_count INTEGER := 0;
  approved_count INTEGER := 0;
  pending_count INTEGER := 0;
  rejected_count INTEGER := 0;
  scheduled_count INTEGER := 0;
  published_count INTEGER := 0;
  platform_dist JSONB := '{}';
  type_dist JSONB := '{}';
  platform_record RECORD;
  type_record RECORD;
BEGIN
  -- Get workspace owner
  SELECT owner_id INTO workspace_owner_id
  FROM public.workspaces
  WHERE id = target_workspace_id;
  
  IF workspace_owner_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found: %', target_workspace_id;
  END IF;
  
  -- Calculate date range for the month
  DECLARE
    start_date TIMESTAMP WITH TIME ZONE := make_date(target_year, target_month, 1);
    end_date TIMESTAMP WITH TIME ZONE := (start_date + INTERVAL '1 month');
  BEGIN
    -- Count posts by status
    SELECT COUNT(*) INTO total_posts_count
    FROM public.posts
    WHERE workspace_id = target_workspace_id
      AND created_at >= start_date
      AND created_at < end_date;
    
    SELECT COUNT(*) INTO approved_count
    FROM public.posts
    WHERE workspace_id = target_workspace_id
      AND created_at >= start_date
      AND created_at < end_date
      AND status = 'Aprovado';
    
    SELECT COUNT(*) INTO pending_count
    FROM public.posts
    WHERE workspace_id = target_workspace_id
      AND created_at >= start_date
      AND created_at < end_date
      AND status = 'Pendente';
    
    SELECT COUNT(*) INTO rejected_count
    FROM public.posts
    WHERE workspace_id = target_workspace_id
      AND created_at >= start_date
      AND created_at < end_date
      AND status = 'Rejeitado';
    
    SELECT COUNT(*) INTO scheduled_count
    FROM public.posts
    WHERE workspace_id = target_workspace_id
      AND created_at >= start_date
      AND created_at < end_date
      AND status = 'Agendado';
    
    SELECT COUNT(*) INTO published_count
    FROM public.posts
    WHERE workspace_id = target_workspace_id
      AND created_at >= start_date
      AND created_at < end_date
      AND status = 'Postado';
    
    -- Calculate platform distribution
    FOR platform_record IN
      SELECT unnest(platforms) as platform, COUNT(*) as count
      FROM public.posts
      WHERE workspace_id = target_workspace_id
        AND created_at >= start_date
        AND created_at < end_date
      GROUP BY unnest(platforms)
    LOOP
      platform_dist := jsonb_set(platform_dist, ARRAY[platform_record.platform], to_jsonb(platform_record.count));
    END LOOP;
    
    -- Calculate post type distribution
    FOR type_record IN
      SELECT post_type::text as type, COUNT(*) as count
      FROM public.posts
      WHERE workspace_id = target_workspace_id
        AND created_at >= start_date
        AND created_at < end_date
      GROUP BY post_type
    LOOP
      type_dist := jsonb_set(type_dist, ARRAY[type_record.type], to_jsonb(type_record.count));
    END LOOP;
  END;
  
  -- Insert or update monthly analytics
  INSERT INTO public.monthly_analytics (
    workspace_id,
    year,
    month,
    total_posts,
    approved_posts,
    pending_posts,
    rejected_posts,
    scheduled_posts,
    published_posts,
    platform_distribution,
    post_type_distribution,
    created_by
  ) VALUES (
    target_workspace_id,
    target_year,
    target_month,
    total_posts_count,
    approved_count,
    pending_count,
    rejected_count,
    scheduled_count,
    published_count,
    platform_dist,
    type_dist,
    workspace_owner_id
  )
  ON CONFLICT (workspace_id, year, month)
  DO UPDATE SET
    total_posts = EXCLUDED.total_posts,
    approved_posts = EXCLUDED.approved_posts,
    pending_posts = EXCLUDED.pending_posts,
    rejected_posts = EXCLUDED.rejected_posts,
    scheduled_posts = EXCLUDED.scheduled_posts,
    published_posts = EXCLUDED.published_posts,
    platform_distribution = EXCLUDED.platform_distribution,
    post_type_distribution = EXCLUDED.post_type_distribution,
    aggregated_at = now();
  
  RETURN TRUE;
END;
$function$;