-- Regenerate all referral codes that contain spaces or special characters
-- This ensures all codes follow the format: ALPHANUMERIC only

DO $$
DECLARE
  invalid_code RECORD;
  new_code TEXT;
  old_code TEXT;
BEGIN
  -- Loop through all referral codes with invalid characters
  FOR invalid_code IN 
    SELECT user_id, referral_code 
    FROM public.referral_codes 
    WHERE referral_code ~ '[^A-Za-z0-9]'
  LOOP
    old_code := invalid_code.referral_code;
    
    -- Generate new sanitized code
    new_code := public.generate_referral_code(invalid_code.user_id);
    
    -- Update referral_codes table
    UPDATE public.referral_codes
    SET referral_code = new_code
    WHERE user_id = invalid_code.user_id;
    
    -- Update referrals table to maintain consistency
    UPDATE public.referrals
    SET referral_code = new_code
    WHERE referral_code = old_code;
    
    -- Log the change
    RAISE NOTICE 'Regenerated referral code for user %: % -> %', 
      invalid_code.user_id, old_code, new_code;
  END LOOP;
  
  RAISE NOTICE 'Referral code regeneration complete';
END $$;