-- Create deleted_users table to preserve analytics data
CREATE TABLE public.deleted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id uuid NOT NULL,
  email text,
  plan_tier plan_tier_enum,
  subscription_status text,
  acquisition_source text,
  acquisition_medium text,
  acquisition_campaign text,
  created_at timestamp with time zone NOT NULL,
  deleted_at timestamp with time zone NOT NULL DEFAULT now(),
  subscription_active boolean DEFAULT false,
  days_as_user integer,
  was_paying_user boolean DEFAULT false,
  total_workspaces_created integer DEFAULT 0,
  total_posts_created integer DEFAULT 0,
  storage_used_mb integer DEFAULT 0
);

-- Enable RLS on deleted_users table
ALTER TABLE public.deleted_users ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view deleted users analytics
CREATE POLICY "Admins can view deleted users analytics" 
ON public.deleted_users 
FOR SELECT 
USING (is_current_user_admin_secure());

-- Create policy for service role to manage deleted users
CREATE POLICY "Service role can manage deleted users" 
ON public.deleted_users 
FOR ALL 
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- Remove CASCADE from user_acquisition_events foreign key to preserve analytics
-- First, drop the existing foreign key constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%user_acquisition_events%user_id%'
        AND table_name = 'user_acquisition_events'
    ) THEN
        ALTER TABLE public.user_acquisition_events 
        DROP CONSTRAINT IF EXISTS user_acquisition_events_user_id_fkey;
    END IF;
END $$;

-- Add the foreign key back without CASCADE to preserve analytics data
ALTER TABLE public.user_acquisition_events 
ADD CONSTRAINT user_acquisition_events_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Create function to calculate user statistics before deletion
CREATE OR REPLACE FUNCTION public.calculate_user_stats_before_deletion(target_user_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_stats JSONB;
  profile_data RECORD;
  days_active INTEGER;
  workspace_count INTEGER;
  post_count INTEGER;
  was_paying BOOLEAN := false;
BEGIN
  -- Get profile data
  SELECT * INTO profile_data 
  FROM public.profiles 
  WHERE user_id = target_user_id;
  
  -- Calculate days as user
  days_active := EXTRACT(DAYS FROM (now() - profile_data.created_at));
  
  -- Count workspaces created
  SELECT COUNT(*) INTO workspace_count
  FROM public.workspaces
  WHERE owner_id = target_user_id;
  
  -- Count posts created
  SELECT COUNT(*) INTO post_count
  FROM public.posts p
  INNER JOIN public.workspaces w ON p.workspace_id = w.id
  WHERE w.owner_id = target_user_id;
  
  -- Check if was ever a paying user
  was_paying := (
    profile_data.plan_tier != 'free' OR 
    profile_data.subscription_active = true OR
    profile_data.subscription_status IN ('active', 'trialing', 'past_due')
  );
  
  -- Build stats object
  user_stats := jsonb_build_object(
    'days_as_user', days_active,
    'total_workspaces_created', workspace_count,
    'total_posts_created', post_count,
    'was_paying_user', was_paying,
    'final_plan_tier', profile_data.plan_tier,
    'final_subscription_status', profile_data.subscription_status,
    'storage_used_mb', profile_data.storage_used_mb,
    'acquisition_source', profile_data.acquisition_source,
    'acquisition_medium', profile_data.acquisition_medium,
    'acquisition_campaign', profile_data.acquisition_campaign
  );
  
  RETURN user_stats;
END;
$$;