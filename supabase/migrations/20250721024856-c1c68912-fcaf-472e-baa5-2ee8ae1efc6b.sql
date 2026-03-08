-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'guest');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE post_type AS ENUM ('Feed', 'Carrossel', 'Reels', 'Storys');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('Pendente', 'Revisado', 'Reprovado', 'Aprovado', 'Programado', 'Postado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE platform_type AS ENUM ('Instagram', 'Facebook', 'LinkedIn', 'YT', 'X', 'Pinterest', 'Reddit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Recreate the function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'::app_role
      ELSE 'guest'::app_role
    END
  );
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();