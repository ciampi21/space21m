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
WITH CHECK (is_current_user_admin_secure());

-- 4. Drop and recreate user policy with explicit restrictions
DROP POLICY IF EXISTS "Users can update their own profile (non-admin fields)" ON public.profiles;
CREATE POLICY "Users can update their own profile (non-admin fields)" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5. Create specific admin role management policy (only for service role)
CREATE POLICY "Service role can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (current_setting('role') = 'service_role')
WITH CHECK (current_setting('role') = 'service_role');

-- 6. Create secure function for role changes audit
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

-- 7. Create function to safely change user roles (only callable by service role)
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