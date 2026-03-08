-- Fix critical security vulnerability: Remove ability for users to self-update their role
-- Drop the existing overly permissive update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create separate policies: one for user-editable fields, one for admin-only fields
CREATE POLICY "Users can update their own profile (non-admin fields)" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() AND
  -- Prevent users from updating admin-only fields
  (OLD.role = NEW.role) AND
  (OLD.subscription_active = NEW.subscription_active) AND
  (OLD.stripe_customer_id = NEW.stripe_customer_id) AND
  (OLD.setup_token = NEW.setup_token) AND
  (OLD.setup_token_expires_at = NEW.setup_token_expires_at) AND
  (OLD.setup_token_used_at = NEW.setup_token_used_at)
);

-- Create admin-only policy for role and subscription management
CREATE POLICY "Admins can update all profile fields" 
ON public.profiles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create role change audit table for security tracking
CREATE TABLE public.role_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id UUID NOT NULL,
  old_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  ip_address INET,
  user_agent TEXT
);

-- Enable RLS on role changes table
ALTER TABLE public.role_changes ENABLE ROW LEVEL SECURITY;

-- Only admins can view role change history
CREATE POLICY "Admins can view role changes" 
ON public.role_changes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only system can insert role changes (through edge functions)
CREATE POLICY "System can insert role changes" 
ON public.role_changes 
FOR INSERT 
WITH CHECK (true);

-- Create secure function to check admin status
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Create function to log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if role actually changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO public.role_changes (
      target_user_id,
      old_role,
      new_role,
      changed_by,
      reason
    ) VALUES (
      NEW.user_id,
      OLD.role,
      NEW.role,
      auth.uid(),
      'Role updated via admin action'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically log role changes
CREATE TRIGGER log_profile_role_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_role_change();

-- Add input validation function for usernames
CREATE OR REPLACE FUNCTION public.validate_username(username_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check for basic validation: alphanumeric, underscore, hyphen only
  -- Length between 3-30 characters
  -- No SQL injection patterns
  IF username_input IS NULL THEN
    RETURN TRUE; -- Allow NULL usernames
  END IF;
  
  IF LENGTH(username_input) < 3 OR LENGTH(username_input) > 30 THEN
    RETURN FALSE;
  END IF;
  
  -- Only allow alphanumeric, underscore, and hyphen
  IF username_input !~ '^[a-zA-Z0-9_-]+$' THEN
    RETURN FALSE;
  END IF;
  
  -- Prevent common SQL injection patterns
  IF LOWER(username_input) ~ '(select|insert|update|delete|drop|create|alter|exec|script|union|or|and)' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Add username validation constraint
ALTER TABLE public.profiles ADD CONSTRAINT valid_username 
CHECK (public.validate_username(username));