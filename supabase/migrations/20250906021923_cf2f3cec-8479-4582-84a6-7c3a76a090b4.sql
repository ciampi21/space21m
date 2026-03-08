-- Add cron job to cleanup unconfirmed users every 12 hours
-- This will run at 6 AM and 6 PM daily
SELECT cron.schedule(
  'cleanup-unconfirmed-users',
  '0 6,18 * * *', 
  $$
  SELECT
    net.http_post(
        url:='https://lqbpqecybxdylqjedwza.supabase.co/functions/v1/cleanup-unconfirmed-users',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnBxZWN5YnhkeWxxamVkd3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNTk1NjMsImV4cCI6MjA2ODYzNTU2M30.-NN_DGqKaNghcnrzYW075KTg_f4W6i-z3n6y4Tq1L_U"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);