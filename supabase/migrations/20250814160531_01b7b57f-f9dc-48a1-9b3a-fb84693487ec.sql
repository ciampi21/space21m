-- PHASE 2: Fix trigger function to use 'user' as default role instead of 'admin'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, role, stripe_customer_id, setup_token, setup_token_expires_at, subscription_active, language)
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.raw_user_meta_data->>'source' = 'stripe_checkout' THEN 'user'  -- Changed from 'admin' to 'user'
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
    END,
    COALESCE(NEW.raw_user_meta_data->>'language', 'en')
  );
  RETURN NEW;
END;
$function$;