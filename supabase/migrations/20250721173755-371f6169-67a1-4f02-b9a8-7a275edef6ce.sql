-- Adicionar colunas de token de setup na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN setup_token TEXT UNIQUE,
ADD COLUMN setup_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN setup_token_used_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para o token de setup
CREATE INDEX idx_profiles_setup_token ON public.profiles(setup_token) WHERE setup_token IS NOT NULL;

-- Remover a tabela setup_tokens que não é mais necessária
DROP TABLE IF EXISTS public.setup_tokens;