-- Update the handle_new_user function to be more robust and avoid duplicate profile errors
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  -- Insert profile with proper conflict handling
  INSERT INTO public.profiles (
    user_id, 
    email, 
    role, 
    stripe_customer_id, 
    setup_token, 
    setup_token_expires_at, 
    subscription_active, 
    language
  )
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.raw_user_meta_data->>'source' = 'stripe_checkout' THEN 'user'
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
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block user creation
    RAISE WARNING 'Failed to create/update profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;