-- Security Enhancement: Restrict plan_limits access to authenticated users only
-- This prevents competitors from viewing complete pricing tier structure
DROP POLICY IF EXISTS "Anyone can read plan limits" ON public.plan_limits;

CREATE POLICY "Authenticated users can read plan limits" 
ON public.plan_limits 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Security Enhancement: Improve invitation email privacy
-- Only workspace admins and the invited user can view invitation details
DROP POLICY IF EXISTS "Users can view invitations they sent" ON public.invitations;

CREATE POLICY "Workspace admins can view invitations" 
ON public.invitations 
FOR SELECT 
USING (
  -- Admin who sent the invitation
  invited_by IN (
    SELECT profiles.id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
  OR
  -- Workspace admins can view all invitations for their workspace
  can_manage_workspace_members(auth.uid(), workspace_id)
);

-- Security Enhancement: Create separate billing_details table for sensitive financial data
CREATE TABLE IF NOT EXISTS public.billing_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  current_subscription_id TEXT,
  current_price_id TEXT,
  subscription_status TEXT,
  last_invoice_status TEXT,
  currency TEXT DEFAULT 'usd',
  billing_banner TEXT,
  past_due_since TIMESTAMP WITH TIME ZONE,
  grace_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on billing_details table
ALTER TABLE public.billing_details ENABLE ROW LEVEL SECURITY;

-- Create policies for billing_details - users can only access their own billing data
CREATE POLICY "Users can view their own billing details" 
ON public.billing_details 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own billing details" 
ON public.billing_details 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage all billing details" 
ON public.billing_details 
FOR ALL 
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- Admins can view billing details for support purposes
CREATE POLICY "Admins can view billing details" 
ON public.billing_details 
FOR SELECT 
USING (is_current_user_admin_secure());

-- Create trigger for updated_at on billing_details
CREATE TRIGGER update_billing_details_updated_at
  BEFORE UPDATE ON public.billing_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing billing data from profiles to billing_details
INSERT INTO public.billing_details (
  user_id,
  stripe_customer_id,
  current_subscription_id,
  current_price_id,
  subscription_status,
  last_invoice_status,
  currency,
  billing_banner,
  past_due_since,
  grace_until
)
SELECT 
  user_id,
  stripe_customer_id,
  current_subscription_id,
  current_price_id,
  subscription_status,
  last_invoice_status,
  currency,
  billing_banner,
  past_due_since,
  grace_until
FROM public.profiles
WHERE stripe_customer_id IS NOT NULL OR current_subscription_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Security Enhancement: Add session activity logging for admin users
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_end TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on admin_sessions
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin session data
CREATE POLICY "Admins can view admin sessions" 
ON public.admin_sessions 
FOR SELECT 
USING (is_current_user_admin_secure());

-- Service role can manage admin sessions
CREATE POLICY "Service role can manage admin sessions" 
ON public.admin_sessions 
FOR ALL 
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- Function to log admin session activity
CREATE OR REPLACE FUNCTION public.log_admin_session_activity(
  admin_id UUID,
  ip_addr INET DEFAULT NULL,
  user_agent_string TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update existing active session or create new one
  INSERT INTO public.admin_sessions (
    admin_user_id,
    ip_address,
    user_agent,
    last_activity
  ) VALUES (
    admin_id,
    ip_addr,
    user_agent_string,
    now()
  )
  ON CONFLICT (admin_user_id) 
  WHERE is_active = true 
  DO UPDATE SET 
    last_activity = now(),
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent;
END;
$$;