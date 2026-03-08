-- Update business plan workspace limit from 100000 to 1000
UPDATE public.plan_limits 
SET max_owned_workspaces = 1000 
WHERE plan_tier = 'business';