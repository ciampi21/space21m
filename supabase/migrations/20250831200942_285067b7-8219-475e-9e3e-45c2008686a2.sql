-- Fix get_supabase_config function to use environment variables instead
CREATE OR REPLACE FUNCTION public.get_supabase_config()
RETURNS TABLE(url text, service_key text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Return hardcoded values for the current project
  -- Service key will be available in edge function context
  SELECT 
    'https://lqbpqecybxdylqjedwza.supabase.co'::text as url,
    ''::text as service_key; -- Edge function will use env var
$$;