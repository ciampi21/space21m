-- Recreate the 60-day trial activation trigger
DROP TRIGGER IF EXISTS trigger_activate_60day_trial ON public.profiles;

CREATE TRIGGER trigger_activate_60day_trial
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_60day_trial();

-- Fix existing account with utm_campaign=60freetrial
UPDATE public.profiles
SET 
  plan_tier = 'premium',
  subscription_status = 'trialing',
  trial_ends_at = NOW() + INTERVAL '60 days',
  updated_at = NOW()
WHERE utm_campaign = '60freetrial'
  AND subscription_status IS NULL
  AND trial_ends_at IS NULL;

-- Create test function for 60-day trial activation
CREATE OR REPLACE FUNCTION public.test_60day_trial_activation()
RETURNS TABLE (
  test_name TEXT,
  result TEXT,
  details TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  test_user_id UUID;
  test_profile RECORD;
BEGIN
  -- Generate unique test email
  test_user_id := gen_random_uuid();
  
  -- Simulate profile insertion with utm_campaign=60freetrial
  INSERT INTO public.profiles (
    user_id, 
    email, 
    utm_campaign,
    role
  ) VALUES (
    test_user_id,
    'test-' || test_user_id::TEXT || '@60daytrial.com', 
    '60freetrial',
    'user'
  ) RETURNING * INTO test_profile;
  
  -- Verify trial was activated correctly
  IF test_profile.plan_tier = 'premium' AND 
     test_profile.subscription_status = 'trialing' AND
     test_profile.trial_ends_at IS NOT NULL AND
     test_profile.trial_ends_at > NOW() + INTERVAL '59 days' THEN
    
    -- Clean up test data
    DELETE FROM public.profiles WHERE user_id = test_user_id;
    
    RETURN QUERY SELECT 
      '60-Day Trial Activation'::TEXT, 
      'PASS'::TEXT, 
      format('Trial activated: plan=%s, status=%s, ends_in=%s days', 
        test_profile.plan_tier, 
        test_profile.subscription_status,
        EXTRACT(DAY FROM (test_profile.trial_ends_at - NOW()))::INTEGER
      )::TEXT;
  ELSE
    -- Clean up test data
    DELETE FROM public.profiles WHERE user_id = test_user_id;
    
    RETURN QUERY SELECT 
      '60-Day Trial Activation'::TEXT, 
      'FAIL'::TEXT, 
      format('Expected premium/trialing/60days, got plan=%s status=%s ends_at=%s', 
        test_profile.plan_tier, 
        test_profile.subscription_status,
        test_profile.trial_ends_at
      )::TEXT;
  END IF;
END;
$$;

-- Log migration success
DO $$
BEGIN
  RAISE NOTICE '[60DAY-TRIAL] Migration completed: trigger recreated, existing accounts fixed, test function created';
END $$;