-- Atualizar função calculate_referral_tier com novos rewards para tiers 4 e 5
CREATE OR REPLACE FUNCTION public.calculate_referral_tier(referrer_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  paid_referrals_count integer;
  user_plan_tier text;
  current_tier integer;
  tier_info jsonb;
BEGIN
  -- Buscar plan_tier do usuário
  SELECT plan_tier::text INTO user_plan_tier
  FROM public.profiles
  WHERE user_id = referrer_uuid;
  
  -- Contar referrals pagos (convertidos)
  SELECT COUNT(*) INTO paid_referrals_count
  FROM public.referrals
  WHERE referrer_user_id = referrer_uuid
    AND status IN ('converted', 'active', 'credited');
  
  -- Tier 6 - Diamond: 50+ indicações pagas → 12 meses grátis
  IF paid_referrals_count >= 50 THEN
    current_tier := 6;
    tier_info := jsonb_build_object(
      'tier', 6,
      'paid_referrals', paid_referrals_count,
      'reward', '12_months_free',
      'next_tier', null,
      'next_tier_at', null
    );
  
  -- Tier 5 - Gold: 10+ indicações pagas → 2 meses grátis
  ELSIF paid_referrals_count >= 10 THEN
    current_tier := 5;
    tier_info := jsonb_build_object(
      'tier', 5,
      'paid_referrals', paid_referrals_count,
      'reward', '2_months_free',
      'next_tier', 6,
      'next_tier_at', 50
    );
  
  -- Tier 4 - Silver: 5+ indicações pagas → +10% armazenamento
  ELSIF paid_referrals_count >= 5 THEN
    current_tier := 4;
    tier_info := jsonb_build_object(
      'tier', 4,
      'paid_referrals', paid_referrals_count,
      'reward', '10_percent_storage_bonus',
      'next_tier', 5,
      'next_tier_at', 10
    );
  
  -- Tier 3 - Bronze: 3+ indicações pagas → 1 mês grátis
  ELSIF paid_referrals_count >= 3 THEN
    current_tier := 3;
    tier_info := jsonb_build_object(
      'tier', 3,
      'paid_referrals', paid_referrals_count,
      'reward', '1_month_free',
      'next_tier', 4,
      'next_tier_at', 5
    );
  
  -- Tier 2 - Copper: Usuário pago (qualquer plano que não seja 'free')
  ELSIF user_plan_tier IS NOT NULL AND user_plan_tier != 'free' THEN
    current_tier := 2;
    tier_info := jsonb_build_object(
      'tier', 2,
      'paid_referrals', paid_referrals_count,
      'reward', null,
      'next_tier', 3,
      'next_tier_at', 3
    );
  
  -- Tier 1 - Iron: Usuário free
  ELSE
    current_tier := 1;
    tier_info := jsonb_build_object(
      'tier', 1,
      'paid_referrals', 0,
      'reward', null,
      'next_tier', 2,
      'next_tier_at', null
    );
  END IF;
  
  RETURN tier_info;
END;
$function$;