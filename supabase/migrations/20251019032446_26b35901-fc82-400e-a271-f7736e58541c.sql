-- ============================================
-- FIX COMPLETO: Sistema de Trial de 60 Dias
-- Adiciona o TRIGGER que estava faltando!
-- ============================================

-- 1. Recriar a função com o plano correto ('pro')
CREATE OR REPLACE FUNCTION public.activate_60day_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se utm_campaign = '60freetrial' e trial não está ativo
  IF NEW.utm_campaign = '60freetrial' AND NEW.trial_ends_at IS NULL THEN
    -- Ativar trial de 60 dias no plano PRO
    NEW.plan_tier := 'pro';
    NEW.subscription_status := 'trialing';
    NEW.trial_ends_at := NOW() + INTERVAL '60 days';
    
    RAISE LOG '[60DAY-TRIAL] Ativado para usuário % com email %', NEW.user_id, NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. CRIAR O TRIGGER (esta é a parte que estava faltando!)
DROP TRIGGER IF EXISTS trigger_activate_60day_trial ON public.profiles;

CREATE TRIGGER trigger_activate_60day_trial
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_60day_trial();

-- 3. Atualizar a conta admin@21m.marketing para pro
UPDATE public.profiles
SET 
  plan_tier = 'pro',
  subscription_status = 'trialing',
  trial_ends_at = NOW() + INTERVAL '60 days',
  updated_at = NOW()
WHERE email = 'admin@21m.marketing'
  AND utm_campaign = '60freetrial';

-- 4. Atualizar contas existentes que foram criadas como premium
UPDATE public.profiles
SET 
  plan_tier = 'pro',
  updated_at = NOW()
WHERE utm_campaign = '60freetrial'
  AND plan_tier = 'premium'
  AND subscription_status = 'trialing';

-- 5. Verificar instalação
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers 
  WHERE trigger_name = 'trigger_activate_60day_trial';
  
  IF trigger_count > 0 THEN
    RAISE NOTICE '✅ [60DAY-TRIAL] Sistema instalado com sucesso!';
    RAISE NOTICE '  - Função activate_60day_trial() criada';
    RAISE NOTICE '  - Trigger ativo no INSERT de profiles';
    RAISE NOTICE '  - Contas existentes atualizadas';
  ELSE
    RAISE EXCEPTION '❌ Trigger não foi criado corretamente';
  END IF;
END $$;