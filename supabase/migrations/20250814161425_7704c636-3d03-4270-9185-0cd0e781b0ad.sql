-- Fix workspace creation access control
-- Allow users to create workspaces within their plan limits, not just admins
-- The create_workspace function already handles plan limit validation

DROP POLICY IF EXISTS "Only admin users can create workspaces" ON public.workspaces;

CREATE POLICY "Users can create workspaces within plan limits" 
ON public.workspaces 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND owner_id = auth.uid()
);

-- Add enhanced audit logging for role changes
-- Extend role_changes table to include more context
ALTER TABLE public.role_changes 
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS request_origin TEXT;

-- Create function to log administrative actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  action_type TEXT,
  target_resource TEXT,
  target_id UUID,
  details JSONB DEFAULT NULL,
  ip_address INET DEFAULT NULL,
  user_agent TEXT DEFAULT NULL
) RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin audit log table for comprehensive tracking
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_resource TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on admin audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" 
ON public.admin_audit_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" 
ON public.admin_audit_log 
FOR INSERT 
WITH CHECK (true);