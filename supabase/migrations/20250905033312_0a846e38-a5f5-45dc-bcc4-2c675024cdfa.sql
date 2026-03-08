-- Add user_reply column to support_tickets table to allow users to respond to admin responses
ALTER TABLE public.support_tickets 
ADD COLUMN user_reply text,
ADD COLUMN user_replied_at timestamp with time zone;