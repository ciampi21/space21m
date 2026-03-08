-- Add acquisition tracking columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS acquisition_source TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS acquisition_medium TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS acquisition_campaign TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referrer_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_ip INET;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create user_acquisition_events table for tracking user journey
CREATE TABLE public.user_acquisition_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'visit', 'signup', 'conversion'
  source TEXT,
  medium TEXT,
  campaign TEXT,
  referrer_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  ip_address INET,
  user_agent TEXT,
  page_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_acquisition_events
ALTER TABLE public.user_acquisition_events ENABLE ROW LEVEL SECURITY;

-- Create policies for user_acquisition_events
CREATE POLICY "Users can view their own acquisition events" 
ON public.user_acquisition_events 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Service role can manage acquisition events" 
ON public.user_acquisition_events 
FOR ALL 
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

CREATE POLICY "Admins can view all acquisition events" 
ON public.user_acquisition_events 
FOR SELECT 
USING (is_current_user_admin_secure());

-- Create index for better performance
CREATE INDEX idx_user_acquisition_events_user_id ON public.user_acquisition_events(user_id);
CREATE INDEX idx_user_acquisition_events_source ON public.user_acquisition_events(source);
CREATE INDEX idx_user_acquisition_events_created_at ON public.user_acquisition_events(created_at);

-- Create function to detect acquisition source from referrer
CREATE OR REPLACE FUNCTION public.detect_acquisition_source(referrer_url TEXT, utm_source TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Use UTM source if available
  IF utm_source IS NOT NULL AND utm_source != '' THEN
    RETURN utm_source;
  END IF;
  
  -- Detect from referrer URL
  IF referrer_url IS NULL OR referrer_url = '' THEN
    RETURN 'direct';
  END IF;
  
  -- Social Media
  IF referrer_url ~* '(facebook|fb\.com|instagram|linkedin|twitter|x\.com)' THEN
    RETURN 'social_media';
  END IF;
  
  -- Search Engines
  IF referrer_url ~* '(google\.com|bing\.com|yahoo\.com|duckduckgo\.com)' THEN
    RETURN 'search_engine';
  END IF;
  
  -- Product Hunt
  IF referrer_url ~* 'producthunt\.com' THEN
    RETURN 'product_hunt';
  END IF;
  
  -- Lovable
  IF referrer_url ~* 'lovable\.(dev|app)' THEN
    RETURN 'lovable';
  END IF;
  
  -- Discord
  IF referrer_url ~* 'discord\.(com|gg)' THEN
    RETURN 'discord';
  END IF;
  
  -- Default to referral
  RETURN 'referral';
END;
$$;