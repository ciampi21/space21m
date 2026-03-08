-- Fix the validate_username function search path
CREATE OR REPLACE FUNCTION public.validate_username(username_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Fix the is_current_user_admin function search path
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