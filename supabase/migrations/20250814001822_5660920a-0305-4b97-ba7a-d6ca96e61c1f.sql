-- Fase 0: Schema Base & Entitlements

-- 1. Criar ENUM para plan_tier
CREATE TYPE public.plan_tier_enum AS ENUM ('free', 'pro', 'premium', 'business');

-- 2. Extensões da tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_tier public.plan_tier_enum DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_early_adopter BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_price_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_subscription_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_banner TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_invoice_status TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS storage_used_mb INTEGER DEFAULT 0;

-- 3. Nova tabela plan_limits
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan_tier TEXT PRIMARY KEY,
  max_owned_workspaces INTEGER,
  max_guest_memberships INTEGER,
  storage_total_mb INTEGER,
  post_expiry_days INTEGER,
  features JSONB DEFAULT '{}'
);

-- Inserir dados dos planos
INSERT INTO public.plan_limits (plan_tier, max_owned_workspaces, max_guest_memberships, storage_total_mb, post_expiry_days, features) VALUES
('free', 1, 5, 300, 90, '{}'),
('pro', 5, NULL, 2048, NULL, '{}'),
('premium', 15, NULL, 4096, NULL, '{"premium_features": true}'),
('business', 100000, NULL, 102400, NULL, '{"premium_features": true}')
ON CONFLICT (plan_tier) DO UPDATE SET
  max_owned_workspaces = EXCLUDED.max_owned_workspaces,
  max_guest_memberships = EXCLUDED.max_guest_memberships,
  storage_total_mb = EXCLUDED.storage_total_mb,
  post_expiry_days = EXCLUDED.post_expiry_days,
  features = EXCLUDED.features;

-- 4. VIEW v_user_entitlements (combina plan_tier + overrides Early Adopter)
CREATE OR REPLACE VIEW public.v_user_entitlements AS
SELECT 
  p.user_id,
  p.email,
  p.plan_tier,
  p.is_early_adopter,
  p.subscription_status,
  -- Aplicar overrides para Early Adopter Premium
  CASE 
    WHEN p.plan_tier = 'premium' AND p.is_early_adopter = true THEN 30
    ELSE pl.max_owned_workspaces
  END as max_owned_workspaces,
  pl.max_guest_memberships,
  CASE 
    WHEN p.plan_tier = 'premium' AND p.is_early_adopter = true THEN 8192
    ELSE pl.storage_total_mb
  END as storage_total_mb,
  pl.post_expiry_days,
  pl.features,
  p.storage_used_mb,
  p.billing_banner,
  p.past_due_since,
  p.grace_until
FROM public.profiles p
LEFT JOIN public.plan_limits pl ON p.plan_tier::text = pl.plan_tier;

-- 5. Atualizar workspace_members - renomear role para role_in_workspace
ALTER TABLE public.workspace_members RENAME COLUMN role TO role_in_workspace;

-- 6. Extensões da tabela workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS autodelete_days INTEGER DEFAULT 90;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_autodelete_days_check 
  CHECK (autodelete_days IN (30,60,90,120,150,180,360) OR autodelete_days IS NULL);

-- 7. Extensões da tabela posts
ALTER TABLE public.posts RENAME COLUMN scheduled_date TO scheduled_for;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ;

-- 8. Nova tabela media_assets para R2
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  r2_key TEXT,
  size_bytes BIGINT,
  mime_type TEXT,
  file_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies para media_assets
CREATE POLICY "Users can view media from their workspaces" ON public.media_assets
FOR SELECT
USING (workspace_id IN (
  SELECT w.id FROM public.workspaces w 
  WHERE w.owner_id = auth.uid() 
  OR w.id IN (
    SELECT wm.workspace_id FROM public.workspace_members wm 
    WHERE wm.user_id = auth.uid()
  )
));

CREATE POLICY "Users can insert media in their workspaces" ON public.media_assets
FOR INSERT
WITH CHECK (workspace_id IN (
  SELECT w.id FROM public.workspaces w 
  WHERE w.owner_id = auth.uid() 
  OR w.id IN (
    SELECT wm.workspace_id FROM public.workspace_members wm 
    WHERE wm.user_id = auth.uid()
  )
));

CREATE POLICY "Users can update media in their workspaces" ON public.media_assets
FOR UPDATE
USING (workspace_id IN (
  SELECT w.id FROM public.workspaces w 
  WHERE w.owner_id = auth.uid() 
  OR w.id IN (
    SELECT wm.workspace_id FROM public.workspace_members wm 
    WHERE wm.user_id = auth.uid()
  )
));

CREATE POLICY "Users can delete media in their workspaces" ON public.media_assets
FOR DELETE
USING (workspace_id IN (
  SELECT w.id FROM public.workspaces w 
  WHERE w.owner_id = auth.uid() 
  OR w.id IN (
    SELECT wm.workspace_id FROM public.workspace_members wm 
    WHERE wm.user_id = auth.uid()
  )
));

-- 9. Trigger posts_compute_expire_at
CREATE OR REPLACE FUNCTION public.posts_compute_expire_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan_tier TEXT;
  workspace_autodelete INTEGER;
BEGIN
  -- Buscar plan_tier do usuário
  SELECT p.plan_tier::text INTO user_plan_tier
  FROM public.profiles p
  WHERE p.user_id = NEW.created_by;
  
  -- Buscar autodelete_days do workspace
  SELECT w.autodelete_days INTO workspace_autodelete
  FROM public.workspaces w
  WHERE w.id = NEW.workspace_id;
  
  -- Calcular expire_at baseado na fórmula
  IF user_plan_tier = 'free' THEN
    -- Free: sempre 90 dias após created_at
    NEW.expire_at := NEW.created_at + INTERVAL '90 days';
  ELSE
    -- Planos pagos
    IF workspace_autodelete IS NULL THEN
      -- Autodelete desativado
      NEW.expire_at := NULL;
    ELSE
      -- Calcular com proteção para agendados/publicados
      NEW.expire_at := GREATEST(
        NEW.created_at + (workspace_autodelete || ' days')::INTERVAL,
        COALESCE(NEW.published_at, NEW.scheduled_for, NEW.created_at) + INTERVAL '30 days'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS posts_compute_expire_at_trigger ON public.posts;
CREATE TRIGGER posts_compute_expire_at_trigger
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.posts_compute_expire_at();

-- 10. RPC create_workspace com validação de entitlements
CREATE OR REPLACE FUNCTION public.create_workspace(
  workspace_name TEXT,
  workspace_description TEXT DEFAULT NULL,
  workspace_image_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Buscar limites do usuário
  SELECT vue.max_owned_workspaces INTO max_allowed
  FROM public.v_user_entitlements vue
  WHERE vue.user_id = user_uuid;
  
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
$$;