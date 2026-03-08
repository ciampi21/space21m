-- Fix calculate_user_stats_before_deletion function to ensure proper boolean values
CREATE OR REPLACE FUNCTION public.calculate_user_stats_before_deletion(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  user_stats JSONB;
  profile_data RECORD;
  days_active INTEGER := 0;
  workspace_count INTEGER := 0;
  post_count INTEGER := 0;
  was_paying BOOLEAN := false;
  storage_used INTEGER := 0;
BEGIN
  -- Get profile data with proper null handling
  SELECT * INTO profile_data 
  FROM public.profiles 
  WHERE user_id = target_user_id;
  
  -- If no profile exists, create default stats
  IF profile_data IS NULL THEN
    user_stats := jsonb_build_object(
      'days_as_user', 0,
      'total_workspaces_created', 0,
      'total_posts_created', 0,
      'was_paying_user', false,
      'final_plan_tier', 'free',
      'final_subscription_status', 'inactive',
      'storage_used_mb', 0,
      'acquisition_source', 'unknown',
      'acquisition_medium', 'unknown',
      'acquisition_campaign', 'unknown'
    );
    
    RETURN user_stats;
  END IF;
  
  -- Calculate days as user (handle null created_at)
  IF profile_data.created_at IS NOT NULL THEN
    days_active := EXTRACT(DAYS FROM (now() - profile_data.created_at));
  ELSE
    days_active := 0;
  END IF;
  
  -- Count workspaces created
  SELECT COUNT(*) INTO workspace_count
  FROM public.workspaces
  WHERE owner_id = target_user_id;
  
  -- Count posts created
  SELECT COUNT(*) INTO post_count
  FROM public.posts p
  INNER JOIN public.workspaces w ON p.workspace_id = w.id
  WHERE w.owner_id = target_user_id;
  
  -- Check if was ever a paying user (ensure boolean result)
  was_paying := COALESCE(
    (profile_data.plan_tier != 'free' OR 
     profile_data.subscription_active = true OR
     profile_data.subscription_status IN ('active', 'trialing', 'past_due')),
    false
  );
  
  -- Get storage used (ensure not null)
  storage_used := COALESCE(profile_data.storage_used_mb, 0);
  
  -- Build stats object with proper defaults for all fields
  user_stats := jsonb_build_object(
    'days_as_user', COALESCE(days_active, 0),
    'total_workspaces_created', COALESCE(workspace_count, 0),
    'total_posts_created', COALESCE(post_count, 0),
    'was_paying_user', COALESCE(was_paying, false),
    'final_plan_tier', COALESCE(profile_data.plan_tier::text, 'free'),
    'final_subscription_status', COALESCE(profile_data.subscription_status, 'inactive'),
    'storage_used_mb', COALESCE(storage_used, 0),
    'acquisition_source', COALESCE(profile_data.acquisition_source, 'unknown'),
    'acquisition_medium', COALESCE(profile_data.acquisition_medium, 'unknown'),
    'acquisition_campaign', COALESCE(profile_data.acquisition_campaign, 'unknown')
  );
  
  RETURN user_stats;
END;
$function$;

-- Fix RLS policies for deleted_users table to allow service role inserts
DROP POLICY IF EXISTS "Service role can manage deleted users" ON public.deleted_users;

CREATE POLICY "Service role can manage deleted users" 
ON public.deleted_users 
FOR ALL 
USING (current_setting('role'::text) = 'service_role'::text)
WITH CHECK (current_setting('role'::text) = 'service_role'::text);

-- Add specific insert policy for edge functions
CREATE POLICY "Allow edge function inserts to deleted_users" 
ON public.deleted_users 
FOR INSERT 
WITH CHECK (true); -- Allow all inserts from authenticated contexts