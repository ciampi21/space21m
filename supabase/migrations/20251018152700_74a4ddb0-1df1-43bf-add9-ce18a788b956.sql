-- ============================================
-- FASE 1: Sistema de Referrals com Tiers
-- ============================================

-- 1.1 Tabela referral_codes
CREATE TABLE referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  referral_code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  
  UNIQUE(user_id)
);

CREATE INDEX idx_referral_codes_code ON referral_codes(referral_code);
CREATE INDEX idx_referral_codes_user ON referral_codes(user_id);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referral codes"
  ON referral_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own referral codes"
  ON referral_codes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage referral codes"
  ON referral_codes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 1.2 Tabela referrals
CREATE TYPE referral_status AS ENUM (
  'pending',
  'converted',
  'active',
  'expired',
  'credited'
);

CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  referred_user_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE,
  referred_email text NOT NULL,
  referral_code text NOT NULL REFERENCES referral_codes(referral_code),
  status referral_status DEFAULT 'pending' NOT NULL,
  
  converted_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  acquisition_metadata jsonb DEFAULT '{}',
  
  UNIQUE(referred_email, referral_code)
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_code ON referrals(referral_code);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

CREATE POLICY "Service role can manage referrals"
  ON referrals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 1.3 Tabela user_benefits
CREATE TYPE benefit_tier AS ENUM (
  'tier_1_base',
  'tier_2_discount',
  'tier_3_referral_credit',
  'tier_4_storage_bonus'
);

CREATE TYPE benefit_status AS ENUM (
  'active',
  'expired',
  'revoked'
);

CREATE TABLE user_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  
  benefit_tier benefit_tier NOT NULL,
  benefit_type text NOT NULL,
  benefit_value jsonb NOT NULL,
  
  status benefit_status DEFAULT 'active' NOT NULL,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,
  activated_at timestamptz DEFAULT now() NOT NULL,
  revoked_at timestamptz,
  
  source_referral_id uuid REFERENCES referrals(id),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_user_benefits_user ON user_benefits(user_id);
CREATE INDEX idx_user_benefits_tier ON user_benefits(benefit_tier);
CREATE INDEX idx_user_benefits_status ON user_benefits(status);
CREATE INDEX idx_user_benefits_expires ON user_benefits(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE user_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own benefits"
  ON user_benefits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage benefits"
  ON user_benefits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 1.4 Function: Gerar Código de Referral
CREATE OR REPLACE FUNCTION generate_referral_code(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_candidate text;
  code_exists boolean;
  username_prefix text;
BEGIN
  SELECT username INTO username_prefix
  FROM profiles
  WHERE user_id = user_uuid;
  
  IF username_prefix IS NULL OR username_prefix = '' THEN
    SELECT substring(email FROM 1 FOR 4) INTO username_prefix
    FROM profiles
    WHERE user_id = user_uuid;
  END IF;
  
  LOOP
    code_candidate := upper(username_prefix || substring(md5(random()::text) FROM 1 FOR 4));
    
    SELECT EXISTS(
      SELECT 1 FROM referral_codes WHERE referral_code = code_candidate
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN code_candidate;
END;
$$;

-- 1.5 Function: Calcular Tier de Referral
CREATE OR REPLACE FUNCTION calculate_referral_tier(referrer_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paid_referrals_count integer;
  current_tier integer;
  tier_info jsonb;
BEGIN
  SELECT COUNT(*) INTO paid_referrals_count
  FROM referrals
  WHERE referrer_user_id = referrer_uuid
    AND status IN ('converted', 'active', 'credited');
  
  IF paid_referrals_count >= 10 THEN
    current_tier := 6;
    tier_info := jsonb_build_object(
      'tier', 6,
      'paid_referrals', paid_referrals_count,
      'reward', '2_months_free',
      'next_tier', null,
      'next_tier_at', null
    );
  ELSIF paid_referrals_count >= 5 THEN
    current_tier := 5;
    tier_info := jsonb_build_object(
      'tier', 5,
      'paid_referrals', paid_referrals_count,
      'reward', '10_percent_storage_bonus',
      'next_tier', 6,
      'next_tier_at', 10
    );
  ELSIF paid_referrals_count >= 3 THEN
    current_tier := 3;
    tier_info := jsonb_build_object(
      'tier', 3,
      'paid_referrals', paid_referrals_count,
      'reward', '1_month_free',
      'next_tier', 5,
      'next_tier_at', 5
    );
  ELSIF paid_referrals_count > 0 THEN
    current_tier := 2;
    tier_info := jsonb_build_object(
      'tier', 2,
      'paid_referrals', paid_referrals_count,
      'reward', null,
      'next_tier', 3,
      'next_tier_at', 3
    );
  ELSE
    current_tier := 1;
    tier_info := jsonb_build_object(
      'tier', 1,
      'paid_referrals', 0,
      'reward', null,
      'next_tier', 3,
      'next_tier_at', 3
    );
  END IF;
  
  RETURN tier_info;
END;
$$;