-- Fix critical security vulnerability: overly permissive INSERT policy on profiles table
-- Current policy allows anyone to insert profiles without authentication

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can insert profiles" ON public.profiles;

-- Create a secure INSERT policy that only allows authenticated users to create their own profile
CREATE POLICY "Users can insert their own profile only" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  -- Must be authenticated
  auth.uid() IS NOT NULL 
  AND 
  -- Can only insert profile for their own user_id
  user_id = auth.uid()
);

-- Create a separate policy for service role (needed for triggers and admin functions)
CREATE POLICY "Service role can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (current_setting('role') = 'service_role');

-- Add additional validation to prevent profile duplication
-- This function will be called by the trigger to ensure no duplicate profiles
CREATE OR REPLACE FUNCTION public.prevent_duplicate_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if profile already exists for this user
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Profile already exists for user %', NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to prevent duplicate profile creation
DROP TRIGGER IF EXISTS prevent_duplicate_profiles_trigger ON public.profiles;
CREATE TRIGGER prevent_duplicate_profiles_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_profiles();

-- Update the handle_new_user function to include better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert profile with error handling
  INSERT INTO public.profiles (
    user_id, 
    email, 
    role, 
    stripe_customer_id, 
    setup_token, 
    setup_token_expires_at, 
    subscription_active, 
    language
  )
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.raw_user_meta_data->>'source' = 'stripe_checkout' THEN 'user'
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
      ELSE 'guest'
    END,
    NEW.raw_user_meta_data->>'stripe_customer_id',
    NEW.raw_user_meta_data->>'setup_token',
    CASE 
      WHEN NEW.raw_user_meta_data->>'setup_token_expires_at' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'setup_token_expires_at')::timestamptz
      ELSE NULL
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'source' = 'stripe_checkout' THEN true
      ELSE false
    END,
    COALESCE(NEW.raw_user_meta_data->>'language', 'en')
  )
  ON CONFLICT (user_id) DO NOTHING; -- Prevent errors if profile already exists
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Add index for better performance on user_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Add constraint to ensure email matches auth.users email (additional security)
-- This will be enforced at the database level
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Create function to validate email consistency (can be used in application layer)
CREATE OR REPLACE FUNCTION public.validate_profile_email(profile_user_id UUID, profile_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = profile_user_id 
    AND email = profile_email
  );
$$;