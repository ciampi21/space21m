-- Fix billing_summary view RLS issue
-- Enable RLS on the billing_summary view
ALTER VIEW public.billing_summary SET (security_barrier = true);

-- The view automatically inherits RLS from the underlying billing_details table
-- but we need to ensure it's properly secured

-- Alternative: Replace view with a secure function-based approach
DROP VIEW IF EXISTS public.billing_summary;

-- Create a simple function instead of a view to avoid RLS inheritance issues
CREATE OR REPLACE FUNCTION public.get_user_billing_info()
RETURNS TABLE(
  id UUID,
  subscription_status TEXT,
  currency TEXT,
  billing_banner TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    bd.id,
    bd.subscription_status,
    bd.currency,
    bd.billing_banner,
    bd.created_at
  FROM public.billing_details bd
  WHERE bd.user_id = auth.uid();
$$;