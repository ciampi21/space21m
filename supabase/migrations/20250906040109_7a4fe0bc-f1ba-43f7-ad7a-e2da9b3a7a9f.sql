-- Modify user_acquisition_events to support anonymous tracking
ALTER TABLE public.user_acquisition_events 
ALTER COLUMN user_id DROP NOT NULL;

-- Add session_id for connecting anonymous events to users
ALTER TABLE public.user_acquisition_events 
ADD COLUMN session_id TEXT;

-- Add index for better performance on session queries
CREATE INDEX idx_user_acquisition_events_session_id ON public.user_acquisition_events(session_id);

-- Add index for event_type queries
CREATE INDEX idx_user_acquisition_events_event_type ON public.user_acquisition_events(event_type);