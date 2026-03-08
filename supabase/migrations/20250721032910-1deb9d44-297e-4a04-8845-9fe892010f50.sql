-- Create the app_role enum type that's missing
CREATE TYPE public.app_role AS ENUM ('admin', 'guest');

-- Ensure the profiles table has the correct structure
-- This will help fix the user creation issues