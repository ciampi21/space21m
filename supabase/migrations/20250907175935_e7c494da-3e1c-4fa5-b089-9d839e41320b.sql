-- First, fix the calculate_user_stats_before_deletion function to handle null profiles
CREATE OR REPLACE FUNCTION public.calculate_user_stats_before_deletion(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  
  -- If no profile exists, get basic data from auth.users
  IF profile_data IS NULL THEN
    -- Create default stats for users without profiles
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
  
  -- Get storage used
  storage_used := COALESCE(profile_data.storage_used_mb, 0);
  
  -- Build stats object
  user_stats := jsonb_build_object(
    'days_as_user', days_active,
    'total_workspaces_created', workspace_count,
    'total_posts_created', post_count,
    'was_paying_user', was_paying,
    'final_plan_tier', COALESCE(profile_data.plan_tier, 'free'),
    'final_subscription_status', COALESCE(profile_data.subscription_status, 'inactive'),
    'storage_used_mb', storage_used,
    'acquisition_source', COALESCE(profile_data.acquisition_source, 'unknown'),
    'acquisition_medium', COALESCE(profile_data.acquisition_medium, 'unknown'),
    'acquisition_campaign', COALESCE(profile_data.acquisition_campaign, 'unknown')
  );
  
  RETURN user_stats;
END;
$function$;