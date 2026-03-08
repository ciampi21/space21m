-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.log_admin_action(
  action_type TEXT,
  target_resource TEXT,
  target_id UUID,
  details JSONB DEFAULT NULL,
  ip_address INET DEFAULT NULL,
  user_agent TEXT DEFAULT NULL
) RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    action_type,
    target_resource,
    target_id,
    details,
    ip_address,
    user_agent,
    performed_at
  ) VALUES (
    auth.uid(),
    action_type,
    target_resource,
    target_id,
    details,
    ip_address,
    user_agent,
    now()
  );
END;
$$;

-- Update manage-user-role edge function to include enhanced audit logging
-- Add rate limiting by extending role_changes with session tracking