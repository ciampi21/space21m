-- PHASE 1: CRITICAL SECURITY FIXES

-- 1. Create secure admin check function to prevent RLS recursion
CREATE OR REPLACE FUNCTION public.is_current_user_admin_secure()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$function$;

-- 2. Drop the dangerous admin policy on profiles table
DROP POLICY IF EXISTS "Admins can update all profile fields" ON public.profiles;

-- 3. Create secure admin-only policy that excludes role field
CREATE POLICY "Admins can update non-role profile fields" 
ON public.profiles 
FOR UPDATE 
USING (is_current_user_admin_secure())
WITH CHECK (
  is_current_user_admin_secure() 
  AND user_id = OLD.user_id  -- Prevent changing user_id
  AND role = OLD.role        -- Prevent changing role field
);

-- 4. Create restricted user policy that explicitly excludes role and admin fields
DROP POLICY IF EXISTS "Users can update their own profile (non-admin fields)" ON public.profiles;
CREATE POLICY "Users can update their own profile (non-admin fields)" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() 
  AND role = OLD.role                           -- Cannot change role
  AND stripe_customer_id = OLD.stripe_customer_id -- Cannot change stripe_customer_id
  AND subscription_active = OLD.subscription_active -- Cannot change subscription_active
  AND plan_tier = OLD.plan_tier                 -- Cannot change plan_tier
  AND is_early_adopter = OLD.is_early_adopter   -- Cannot change is_early_adopter
  AND setup_token = OLD.setup_token             -- Cannot change setup_token
  AND setup_token_expires_at = OLD.setup_token_expires_at -- Cannot change setup_token_expires_at
  AND setup_token_used_at = OLD.setup_token_used_at -- Cannot change setup_token_used_at
);

-- 5. Create specific admin role management policy (only for authorized operations)
CREATE POLICY "Authorized admin role changes only" 
ON public.profiles 
FOR UPDATE 
USING (
  -- Only allow updates via service role (for manage-user-role function)
  current_setting('role') = 'service_role'
  OR 
  -- Or if current user is admin and updating role field through proper channels
  (is_current_user_admin_secure() AND user_id != auth.uid()) -- Admins cannot change their own role
);

-- 6. Add RLS policies to v_user_entitlements view (if it's a table) or secure it
-- First check if it's a view or table, then add appropriate security

-- 7. Create secure function for role changes audit
CREATE OR REPLACE FUNCTION public.log_role_change(
  target_user_id UUID,
  old_role TEXT,
  new_role TEXT,
  changed_by UUID,
  reason TEXT DEFAULT NULL,
  ip_address INET DEFAULT NULL,
  user_agent TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.role_changes (
    target_user_id,
    changed_by,
    old_role,
    new_role,
    reason,
    ip_address,
    user_agent
  ) VALUES (
    target_user_id,
    changed_by,
    old_role,
    new_role,
    COALESCE(reason, 'Role changed via admin function'),
    ip_address,
    user_agent
  );
END;
$function$;

-- 8. Create function to safely change user roles (only callable by service role)
CREATE OR REPLACE FUNCTION public.change_user_role_secure(
  target_user_id UUID,
  new_role TEXT,
  changed_by UUID,
  reason TEXT DEFAULT NULL,
  ip_address INET DEFAULT NULL,
  user_agent TEXT DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  old_role TEXT;
  admin_user_id UUID;
BEGIN
  -- Only allow service role to execute this function
  IF current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: This function can only be called with service role privileges';
  END IF;

  -- Validate new role
  IF new_role NOT IN ('admin', 'user', 'guest') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  -- Get current role
  SELECT role INTO old_role 
  FROM public.profiles 
  WHERE user_id = target_user_id;

  IF old_role IS NULL THEN
    RAISE EXCEPTION 'User not found: %', target_user_id;
  END IF;

  -- Verify the admin user exists and has admin role
  SELECT user_id INTO admin_user_id 
  FROM public.profiles 
  WHERE user_id = changed_by AND role = 'admin';

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only admin users can change roles';
  END IF;

  -- Prevent admins from demoting themselves
  IF changed_by = target_user_id AND old_role = 'admin' AND new_role != 'admin' THEN
    RAISE EXCEPTION 'Admins cannot demote themselves';
  END IF;

  -- Update the role
  UPDATE public.profiles 
  SET role = new_role, updated_at = now()
  WHERE user_id = target_user_id;

  -- Log the change
  PERFORM public.log_role_change(
    target_user_id,
    old_role,
    new_role,
    changed_by,
    reason,
    ip_address,
    user_agent
  );

  RETURN true;
END;
$function$;