-- Fix Security Definer View issue: Add RLS to v_user_entitlements view

-- First, convert the view to a table with RLS to control access
-- Since views can't have RLS directly, we need to either:
-- 1. Add RLS policies to underlying tables (already done for profiles, plan_limits)
-- 2. Create a security definer function instead of a view
-- 3. Ensure the view is only accessible with proper permissions

-- The issue is that the view joins profiles with plan_limits
-- We need to ensure users can only see their own entitlements

-- Let's create a secure function to replace the problematic view access pattern
CREATE OR REPLACE FUNCTION public.get_user_entitlements(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  plan_tier plan_tier_enum,
  is_early_adopter BOOLEAN,
  subscription_status TEXT,
  max_owned_workspaces INTEGER,
  max_guest_memberships INTEGER,
  storage_total_mb INTEGER,
  post_expiry_days INTEGER,
  features JSONB,
  storage_used_mb INTEGER,
  billing_banner TEXT,
  past_due_since TIMESTAMPTZ,
  grace_until TIMESTAMPTZ
)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  -- Only allow users to see their own entitlements or admins to see any
  SELECT 
    p.user_id,
    p.email,
    p.plan_tier,
    p.is_early_adopter,
    p.subscription_status,
    CASE
        WHEN ((p.plan_tier = 'premium'::plan_tier_enum) AND (p.is_early_adopter = true)) THEN 30
        ELSE pl.max_owned_workspaces
    END AS max_owned_workspaces,
    pl.max_guest_memberships,
    CASE
        WHEN ((p.plan_tier = 'premium'::plan_tier_enum) AND (p.is_early_adopter = true)) THEN 8192
        ELSE pl.storage_total_mb
    END AS storage_total_mb,
    pl.post_expiry_days,
    pl.features,
    p.storage_used_mb,
    p.billing_banner,
    p.past_due_since,
    p.grace_until
  FROM profiles p
  LEFT JOIN plan_limits pl ON ((p.plan_tier)::text = pl.plan_tier)
  WHERE p.user_id = user_uuid
  AND (
    -- User can only see their own data
    p.user_id = auth.uid()
    OR 
    -- Or if current user is admin (checked via secure function)
    is_current_user_admin_secure()
  );
$function$;

-- Update the create_workspace function to use the secure function instead of the view
CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name text, workspace_description text DEFAULT NULL::text, workspace_image_url text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  user_uuid UUID;
  current_owned_count INTEGER;
  max_allowed INTEGER;
  new_workspace_id UUID;
BEGIN
  -- Verificar autenticação
  user_uuid := auth.uid();
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Buscar limites do usuário usando função segura
  SELECT max_owned_workspaces INTO max_allowed
  FROM public.get_user_entitlements(user_uuid);
  
  IF max_allowed IS NULL THEN
    RAISE EXCEPTION 'User entitlements not found';
  END IF;
  
  -- Contar workspaces atuais
  SELECT COUNT(*) INTO current_owned_count
  FROM public.workspaces w
  WHERE w.owner_id = user_uuid;
  
  -- Verificar limite
  IF current_owned_count >= max_allowed THEN
    RAISE EXCEPTION 'Workspace limit exceeded. Current: %, Max: %', current_owned_count, max_allowed;
  END IF;
  
  -- Criar workspace
  INSERT INTO public.workspaces (name, description, image_url, owner_id)
  VALUES (workspace_name, workspace_description, workspace_image_url, user_uuid)
  RETURNING id INTO new_workspace_id;
  
  RETURN new_workspace_id;
END;
$function$;