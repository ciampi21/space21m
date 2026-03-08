-- Add utm_id column to profiles table for tracking campaign identifiers
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS utm_id TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_utm_id 
ON public.profiles(utm_id);

-- Add comment to document the column
COMMENT ON COLUMN public.profiles.utm_id IS 'Unique identifier for tracking specific campaign instances (UTM ID parameter)';