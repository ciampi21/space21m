-- Fix get_supabase_config function to properly return service key
CREATE OR REPLACE FUNCTION public.get_supabase_config()
RETURNS TABLE(url text, service_key text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Return hardcoded values for the current project
  SELECT 
    'https://lqbpqecybxdylqjedwza.supabase.co'::text as url,
    current_setting('secrets.SUPABASE_SERVICE_ROLE_KEY', false)::text as service_key;
$$;