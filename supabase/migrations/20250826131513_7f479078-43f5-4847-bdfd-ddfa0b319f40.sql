-- Fix security issues in administrative tables
-- Remove overly permissive INSERT policies and strengthen access controls

-- Fix admin_audit_log table policies
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_log;

-- Ensure only service role and specific functions can insert audit logs
CREATE POLICY "Service role and functions can insert audit logs" 
ON public.admin_audit_log 
FOR INSERT 
WITH CHECK (
  current_setting('role') = 'service_role' 
  OR current_setting('role') = 'postgres'
);

-- Fix role_changes table policies  
DROP POLICY IF EXISTS "System can insert role changes" ON public.role_changes;

-- Ensure only service role and specific functions can insert role changes
CREATE POLICY "Service role and functions can insert role changes" 
ON public.role_changes 
FOR INSERT 
WITH CHECK (
  current_setting('role') = 'service_role' 
  OR current_setting('role') = 'postgres'
);

-- Strengthen admin_sessions policies by removing duplicate policies
DROP POLICY IF EXISTS "Service role session management" ON public.admin_sessions;

-- Ensure admin_audit_log SELECT policies are restrictive
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;

-- Create more secure admin audit log access policy
CREATE POLICY "Authenticated admins can view audit logs" 
ON public.admin_audit_log 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_current_user_admin_secure() 
  AND current_setting('role') != 'anon'
);

-- Strengthen role_changes SELECT policy
DROP POLICY IF EXISTS "Admins can view role changes" ON public.role_changes;

CREATE POLICY "Authenticated admins can view role changes" 
ON public.role_changes 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_current_user_admin_secure() 
  AND current_setting('role') != 'anon'
);

-- Strengthen admin_sessions SELECT policies by removing less secure one
DROP POLICY IF EXISTS "Admins can view admin sessions" ON public.admin_sessions;

-- Keep only the most restrictive admin session access policy
-- (The "Admin own session access only" policy already exists and is secure)