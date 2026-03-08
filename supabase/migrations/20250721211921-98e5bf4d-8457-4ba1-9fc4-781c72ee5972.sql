-- Corrigir a função handle_new_user para processar corretamente os metadados do Stripe
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Recriar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();