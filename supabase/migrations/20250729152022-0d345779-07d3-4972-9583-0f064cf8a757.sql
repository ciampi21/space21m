-- Fix search path security issue for existing functions
CREATE OR REPLACE FUNCTION public.user_belongs_to_workspace(user_uuid uuid, workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = workspace_uuid AND owner_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = workspace_uuid AND user_id = user_uuid
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace_members(user_uuid uuid, workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = workspace_uuid AND owner_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = workspace_uuid AND user_id = user_uuid AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_user_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, role, stripe_customer_id, setup_token, setup_token_expires_at, subscription_active)
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.raw_user_meta_data->>'source' = 'stripe_checkout' THEN 'admin'
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
    END
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_owner_as_workspace_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by, invited_at)
  VALUES (NEW.id, NEW.owner_id, 'admin', NEW.owner_id, NOW());
  RETURN NEW;
END;
$function$;