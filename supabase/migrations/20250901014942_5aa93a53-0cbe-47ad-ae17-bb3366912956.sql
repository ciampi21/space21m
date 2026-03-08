-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to run cleanup-deleted-media weekly (every Sunday at 2 AM)
SELECT cron.schedule(
  'cleanup-deleted-media-weekly',
  '0 2 * * 0', -- Every Sunday at 2 AM
  $$
  SELECT
    net.http_post(
        url:='https://lqbpqecybxdylqjedwza.supabase.co/functions/v1/cleanup-deleted-media',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnBxZWN5YnhkeWxxamVkd3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNTk1NjMsImV4cCI6MjA2ODYzNTU2M30.-NN_DGqKaNghcnrzYW075KTg_f4W6i-z3n6y4Tq1L_U"}'::jsonb,
        body:=concat('{"scheduled": true, "time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create a function to manually trigger cleanup (for immediate execution)
CREATE OR REPLACE FUNCTION public.trigger_media_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow admins or service role to trigger cleanup
  IF NOT (is_current_user_admin_secure() OR current_setting('role') = 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can trigger media cleanup';
  END IF;
  
  -- Call the cleanup edge function
  PERFORM net.http_post(
    url => 'https://lqbpqecybxdylqjedwza.supabase.co/functions/v1/cleanup-deleted-media',
    headers => '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnBxZWN5YnhkeWxxamVkd3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNTk1NjMsImV4cCI6MjA2ODYzNTU2M30.-NN_DGqKaNghcnrzYW075KTg_f4W6i-z3n6y4Tq1L_U"}'::jsonb,
    body => concat('{"manual_trigger": true, "time": "', now(), '"}')::jsonb
  );
  
  RAISE NOTICE 'Media cleanup triggered successfully';
END;
$function$;