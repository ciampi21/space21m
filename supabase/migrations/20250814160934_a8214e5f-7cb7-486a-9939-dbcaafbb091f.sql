-- Remove the insecure v_user_entitlements view
-- This view was causing security issues as it had no access control
-- Replaced with secure function get_user_entitlements() that enforces proper authorization

DROP VIEW IF EXISTS public.v_user_entitlements;