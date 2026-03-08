-- Fix foreign key constraint on user_acquisition_events to allow user deletion
-- This will allow user_id to be set to NULL when a user is deleted, preserving analytics data

-- First, ensure the user_id column allows NULL values (it should already, but let's be safe)
ALTER TABLE public.user_acquisition_events 
ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing foreign key constraint if it exists
-- We need to find the constraint name first, but we'll use a more direct approach
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the foreign key constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint 
    WHERE conrelid = 'public.user_acquisition_events'::regclass 
    AND confrelid = 'auth.users'::regclass;
    
    -- Drop the constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.user_acquisition_events DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- Add a new foreign key constraint with ON DELETE SET NULL
-- This will automatically set user_id to NULL when a user is deleted
ALTER TABLE public.user_acquisition_events 
ADD CONSTRAINT user_acquisition_events_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;