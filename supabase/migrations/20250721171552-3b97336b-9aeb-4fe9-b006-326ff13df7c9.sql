
-- Criar tabela para tokens temporários de configuração de conta
CREATE TABLE public.setup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '48 hours'),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_setup_tokens_token ON public.setup_tokens(token);
CREATE INDEX idx_setup_tokens_email ON public.setup_tokens(email);
CREATE INDEX idx_setup_tokens_expires_at ON public.setup_tokens(expires_at);

-- Habilitar RLS
ALTER TABLE public.setup_tokens ENABLE ROW LEVEL SECURITY;

-- Política para permitir que edge functions gerenciem os tokens
CREATE POLICY "Service role can manage setup tokens" ON public.setup_tokens
FOR ALL USING (true);
