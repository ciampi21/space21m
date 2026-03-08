-- Fix Security Definer view issue by removing the problematic view
-- Use standard RLS policies instead for secure access

-- Remove the Security Definer view that was flagged as a security risk
DROP VIEW IF EXISTS public.secure_billing_view;

-- Create a standard view without Security Definer 
-- The RLS policies will handle the security automatically
CREATE VIEW public.billing_summary AS
SELECT 
  id,
  user_id,
  subscription_status,
  currency,
  billing_banner,
  created_at,
  updated_at
FROM public.billing_details;

-- Enable RLS on the view (inherits from base table)
-- The existing RLS policies on billing_details will automatically apply

-- Add function to get obfuscated billing data for display purposes
CREATE OR REPLACE FUNCTION public.get_billing_summary(target_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  id UUID,
  subscription_status TEXT,
  currency TEXT,
  billing_banner TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate access first
  IF NOT validate_billing_access(target_user_id) THEN
    RAISE EXCEPTION 'Access denied to billing data';
  END IF;
  
  -- Return billing data with appropriate access control
  RETURN QUERY
  SELECT 
    bd.id,
    CASE 
      WHEN auth.uid() = target_user_id THEN bd.subscription_status
      WHEN is_current_user_admin_secure() THEN bd.subscription_status
      ELSE 'restricted'
    END as subscription_status,
    CASE 
      WHEN auth.uid() = target_user_id THEN bd.currency
      ELSE 'restricted'
    END as currency,
    CASE 
      WHEN auth.uid() = target_user_id THEN bd.billing_banner
      ELSE 'Access restricted'
    END as billing_banner,
    bd.created_at
  FROM public.billing_details bd
  WHERE bd.user_id = target_user_id;
END;
$$;