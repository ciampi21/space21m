-- Add rejection_reason column to posts table
ALTER TABLE public.posts 
ADD COLUMN rejection_reason TEXT;