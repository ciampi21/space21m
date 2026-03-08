-- Fix function search path security issue for the new validation function
CREATE OR REPLACE FUNCTION public.validate_profile_email(profile_user_id UUID, profile_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = profile_user_id 
    AND email = profile_email
  );
$$;