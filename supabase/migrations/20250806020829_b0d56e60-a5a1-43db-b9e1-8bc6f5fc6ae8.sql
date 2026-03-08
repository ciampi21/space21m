-- Add date_format column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN date_format TEXT DEFAULT 'DD/MM/YYYY' CHECK (date_format IN ('DD/MM/YYYY', 'MM/DD/YYYY'));