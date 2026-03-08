-- Add utm_id column to user_acquisition_events table
ALTER TABLE public.user_acquisition_events 
ADD COLUMN IF NOT EXISTS utm_id TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_acquisition_events_utm_id 
ON public.user_acquisition_events(utm_id);

-- Add comment to document the column
COMMENT ON COLUMN public.user_acquisition_events.utm_id IS 'Unique identifier for tracking specific campaign instances (UTM ID parameter)';