-- 1. Add trial_ends_at column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends_at 
ON public.profiles(trial_ends_at) 
WHERE trial_ends_at IS NOT NULL;

COMMENT ON COLUMN public.profiles.trial_ends_at IS 
'End date of 60-day free trial activated via utm_campaign=60freetrial';

-- 2. Trigger function to auto-activate trial
CREATE OR REPLACE FUNCTION public.activate_60day_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if utm_campaign = '60freetrial' and trial not active
  IF NEW.utm_campaign = '60freetrial' AND NEW.trial_ends_at IS NULL THEN
    -- Activate 60-day trial on PRO plan
    NEW.plan_tier := 'premium';
    NEW.subscription_status := 'trialing';
    NEW.trial_ends_at := NOW() + INTERVAL '60 days';
    
    RAISE LOG '[60DAY-TRIAL] Activated for user % with email %', NEW.user_id, NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Create trigger on profile insert
DROP TRIGGER IF EXISTS trigger_activate_60day_trial ON public.profiles;
CREATE TRIGGER trigger_activate_60day_trial
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_60day_trial();

-- 4. Create trial_notifications table
CREATE TABLE IF NOT EXISTS public.trial_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email_d7', 'email_d3', 'email_d1', 'app_d7', 'app_d3', 'app_d1')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  trial_ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, notification_type)
);

-- RLS for trial_notifications
ALTER TABLE public.trial_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trial notifications"
ON public.trial_notifications
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Service role can manage trial notifications"
ON public.trial_notifications
FOR ALL
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

CREATE INDEX idx_trial_notifications_user_type 
ON public.trial_notifications(user_id, notification_type);

COMMENT ON TABLE public.trial_notifications IS 
'Tracks trial notification delivery to prevent duplicates';