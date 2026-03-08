-- Corrigir issues de segurança

-- 1. Habilitar RLS na tabela plan_limits
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

-- 2. Criar policy para plan_limits (somente leitura para todos)
CREATE POLICY "Anyone can read plan limits" ON public.plan_limits
FOR SELECT
USING (true);

-- 3. Recriar v_user_entitlements sem SECURITY DEFINER para evitar warning
DROP VIEW IF EXISTS public.v_user_entitlements;
CREATE VIEW public.v_user_entitlements AS
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