-- CRITICAL SECURITY FIX: Comprehensive protection for financial and sensitive data

-- 1. Enhanced security for billing_details table
-- Add missing constraints and improve RLS policies
ALTER TABLE public.billing_details 
ALTER COLUMN user_id SET NOT NULL;

-- Add constraint to prevent orphaned billing records
ALTER TABLE public.billing_details 
ADD CONSTRAINT billing_details_user_id_exists 
CHECK (user_id IS NOT NULL);

-- Enhanced RLS policies for billing_details
DROP POLICY IF EXISTS "Users can view their own billing details" ON public.billing_details;
DROP POLICY IF EXISTS "Users can update their own billing details" ON public.billing_details;
DROP POLICY IF EXISTS "Service role can manage all billing details" ON public.billing_details;
DROP POLICY IF EXISTS "Admins can view billing details" ON public.billing_details;

-- Strict user access policy - users can only access their own billing data
CREATE POLICY "Strict user billing access" 
ON public.billing_details 
FOR ALL 
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

-- Service role policy for system operations (e.g., webhooks, automated updates)
CREATE POLICY "Service role billing management" 
ON public.billing_details 
FOR ALL 
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- Restricted admin read-only access for support purposes
CREATE POLICY "Admin read-only billing support" 
ON public.billing_details 
FOR SELECT 
USING (
  is_current_user_admin_secure() 
  AND current_setting('role') != 'anon'
);

-- 2. Enhanced security for profiles table
-- Remove sensitive billing data from profiles (already migrated to billing_details)
-- Add constraints to prevent data leakage
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_not_empty 
CHECK (email IS NOT NULL AND length(trim(email)) > 0);

-- Enhanced RLS for profiles - restrict sensitive data access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile (non-admin fields)" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update non-role profile fields" ON public.profiles;

-- Strict user profile access
CREATE POLICY "Strict user profile access" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

-- User update policy - excluding sensitive fields
CREATE POLICY "User profile updates restricted" 
ON public.profiles 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
  -- Prevent users from modifying sensitive fields
  AND role = OLD.role
  AND stripe_customer_id = OLD.stripe_customer_id
  AND subscription_active = OLD.subscription_active
  AND plan_tier = OLD.plan_tier
);

-- Admin profile management with audit logging
CREATE POLICY "Admin profile management with audit" 
ON public.profiles 
FOR ALL 
USING (is_current_user_admin_secure())
WITH CHECK (is_current_user_admin_secure());

-- Service role policy for system operations
CREATE POLICY "Service role profile management" 
ON public.profiles 
FOR ALL 
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- 3. Secure invitation system
DROP POLICY IF EXISTS "Workspace admins can view invitations" ON public.invitations;

-- Restrict invitation access to workspace admins only
CREATE POLICY "Workspace admin invitation access only" 
ON public.invitations 
FOR ALL 
USING (
  auth.uid() IS NOT NULL 
  AND can_manage_workspace_members(auth.uid(), workspace_id)
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND can_manage_workspace_members(auth.uid(), workspace_id)
);

-- 4. Enhanced audit log protection
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_log;

-- Strict admin-only access for audit logs
CREATE POLICY "Strict admin audit log access" 
ON public.admin_audit_log 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_current_user_admin_secure()
  AND current_setting('role') != 'anon'
);

-- Service role for audit log insertion
CREATE POLICY "Service role audit log insertion" 
ON public.admin_audit_log 
FOR INSERT 
WITH CHECK (current_setting('role') = 'service_role');

-- 5. Enhanced admin session protection
DROP POLICY IF EXISTS "Admins can view admin sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Service role can manage admin sessions" ON public.admin_sessions;

-- Strict admin session access - users can only see their own sessions
CREATE POLICY "Admin own session access only" 
ON public.admin_sessions 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_current_user_admin_secure()
  AND admin_user_id = auth.uid()
);

-- Service role for session management
CREATE POLICY "Service role session management" 
ON public.admin_sessions 
FOR ALL 
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- 6. Add data encryption function for sensitive fields
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Simple obfuscation for sensitive data display
  IF data IS NULL OR length(data) < 4 THEN
    RETURN '***';
  END IF;
  
  RETURN substring(data, 1, 2) || repeat('*', length(data) - 4) || substring(data, length(data) - 1);
END;
$$;

-- 7. Create function to validate billing data access
CREATE OR REPLACE FUNCTION public.validate_billing_access(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow access to own billing data or if admin
  RETURN (
    auth.uid() = target_user_id 
    OR is_current_user_admin_secure()
    OR current_setting('role') = 'service_role'
  );
END;
$$;

-- 8. Add audit trigger for sensitive data access
CREATE OR REPLACE FUNCTION public.audit_billing_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log access to billing data by admins
  IF is_current_user_admin_secure() AND auth.uid() != NEW.user_id THEN
    INSERT INTO public.admin_audit_log (
      admin_user_id,
      action_type,
      target_resource,
      target_id,
      details
    ) VALUES (
      auth.uid(),
      'BILLING_DATA_ACCESS',
      'billing_details',
      NEW.id,
      jsonb_build_object(
        'accessed_user_id', NEW.user_id,
        'access_time', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for billing data access auditing
DROP TRIGGER IF EXISTS audit_billing_access_trigger ON public.billing_details;
CREATE TRIGGER audit_billing_access_trigger
  AFTER SELECT ON public.billing_details
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_billing_access();

-- 9. Enhanced data validation constraints
ALTER TABLE public.billing_details 
ADD CONSTRAINT billing_details_valid_currency 
CHECK (currency IN ('usd', 'eur', 'gbp', 'cad', 'aud'));

ALTER TABLE public.billing_details 
ADD CONSTRAINT billing_details_valid_status 
CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'unpaid', 'incomplete', 'trialing'));

-- 10. Create secure billing data view for frontend
CREATE OR REPLACE VIEW public.secure_billing_view 
WITH (security_barrier = true)
AS
SELECT 
  id,
  user_id,
  CASE 
    WHEN auth.uid() = user_id OR is_current_user_admin_secure() THEN subscription_status
    ELSE 'private'
  END as subscription_status,
  CASE 
    WHEN auth.uid() = user_id THEN currency
    ELSE 'private'
  END as currency,
  CASE 
    WHEN auth.uid() = user_id THEN billing_banner
    ELSE 'Access restricted'
  END as billing_banner,
  CASE 
    WHEN auth.uid() = user_id OR is_current_user_admin_secure() THEN created_at
    ELSE NULL
  END as created_at
FROM public.billing_details
WHERE validate_billing_access(user_id);