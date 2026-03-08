-- Add metrics visibility control to workspaces table
CREATE TYPE public.metrics_visibility_enum AS ENUM ('owner_only', 'all', 'disabled');

ALTER TABLE public.workspaces 
ADD COLUMN metrics_visibility public.metrics_visibility_enum NOT NULL DEFAULT 'owner_only';