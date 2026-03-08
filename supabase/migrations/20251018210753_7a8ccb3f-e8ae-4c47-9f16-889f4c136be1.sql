-- Fix referral code generation to sanitize usernames
-- Remove spaces and special characters from username prefix

CREATE OR REPLACE FUNCTION public.generate_referral_code(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_candidate text;
  code_exists boolean;
  username_prefix text;
  email_prefix text;
BEGIN
  -- Buscar username
  SELECT username INTO username_prefix
  FROM profiles
  WHERE user_id = user_uuid;
  
  -- Sanitizar username: remover espaços e caracteres especiais
  IF username_prefix IS NOT NULL AND username_prefix != '' THEN
    -- Remover tudo exceto letras e números
    username_prefix := regexp_replace(username_prefix, '[^A-Za-z0-9]', '', 'g');
    -- Converter para maiúsculas
    username_prefix := upper(username_prefix);
    -- Limitar a 8 caracteres
    username_prefix := substring(username_prefix FROM 1 FOR 8);
  END IF;
  
  -- Fallback: usar email se username ficou vazio após sanitização
  IF username_prefix IS NULL OR username_prefix = '' THEN
    SELECT email INTO email_prefix
    FROM profiles
    WHERE user_id = user_uuid;
    
    -- Sanitizar email (pegar parte antes do @)
    email_prefix := split_part(email_prefix, '@', 1);
    email_prefix := regexp_replace(email_prefix, '[^A-Za-z0-9]', '', 'g');
    username_prefix := upper(substring(email_prefix FROM 1 FOR 4));
  END IF;
  
  -- Garantir que temos pelo menos algo
  IF username_prefix IS NULL OR username_prefix = '' THEN
    username_prefix := 'USER';
  END IF;
  
  -- Gerar código único
  LOOP
    -- Concatenar prefixo sanitizado + 4 caracteres aleatórios
    code_candidate := username_prefix || substring(upper(md5(random()::text)) FROM 1 FOR 4);
    
    -- Verificar se código já existe
    SELECT EXISTS(
      SELECT 1 FROM referral_codes WHERE referral_code = code_candidate
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN code_candidate;
END;
$$;