-- Fix 60-day trial to use 'pro' plan instead of 'premium'

-- 1. Update the activate_60day_trial function to use 'pro'
CREATE OR REPLACE FUNCTION public.activate_60day_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if utm_campaign = '60freetrial' and trial not active
  IF NEW.utm_campaign = '60freetrial' AND NEW.trial_ends_at IS NULL THEN
    -- Activate 60-day trial on PRO plan (not premium)
    NEW.plan_tier := 'pro';
    NEW.subscription_status := 'trialing';
    NEW.trial_ends_at := NOW() + INTERVAL '60 days';
    
    RAISE LOG '[60DAY-TRIAL] Activated for user % with email %', NEW.user_id, NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Update existing accounts that were incorrectly set to 'premium'
UPDATE public.profiles
SET 
  plan_tier = 'pro',
  updated_at = NOW()
WHERE utm_campaign = '60freetrial'
  AND plan_tier = 'premium'
  AND subscription_status = 'trialing'
  AND trial_ends_at IS NOT NULL;

-- 3. Update test function to check for 'pro' plan
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
  test_user_id := gen_random_uuid();
  
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
  
  -- Verify trial was activated correctly with 'pro' plan
  IF test_profile.plan_tier = 'pro' AND 
     test_profile.subscription_status = 'trialing' AND
     test_profile.trial_ends_at IS NOT NULL AND
     test_profile.trial_ends_at > NOW() + INTERVAL '59 days' THEN
    
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
    DELETE FROM public.profiles WHERE user_id = test_user_id;
    
    RETURN QUERY SELECT 
      '60-Day Trial Activation'::TEXT, 
      'FAIL'::TEXT, 
      format('Expected pro/trialing/60days, got plan=%s status=%s ends_at=%s', 
        test_profile.plan_tier, 
        test_profile.subscription_status,
        test_profile.trial_ends_at
      )::TEXT;
  END IF;
END;
$$;

-- Log the correction
DO $$
BEGIN
  RAISE NOTICE '[60DAY-TRIAL] ✅ Corrected plan_tier from premium to pro';
END $$;