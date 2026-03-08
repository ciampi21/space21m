import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { referrerUserId, tier } = await req.json();

    if (!referrerUserId || !tier) {
      throw new Error('Missing required fields');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Applying tier ${tier} benefits for user ${referrerUserId}`);

    // Aplicar benefícios baseado no tier
    switch (tier) {
      case 3: {
        // 1 mês grátis
        await supabase.from('user_benefits').insert({
          user_id: referrerUserId,
          benefit_tier: 'tier_3_referral_credit',
          benefit_type: 'referral_1_month_free',
          benefit_value: { type: 'free_days', value: 30 },
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        });
        console.log(`Applied tier 3: 1 month free`);
        break;
      }
      case 4: {
        // 10% mais armazenamento
        const { error: insertError } = await supabase.from('user_benefits').insert({
          user_id: referrerUserId,
          benefit_tier: 'tier_4_storage_bonus',
          benefit_type: 'storage_bonus_10_percent',
          benefit_value: { type: 'storage_multiplier', value: 1.1 },
          expires_at: null
        });
        if (insertError && insertError.code !== '23505') {
          throw insertError;
        }
        console.log(`Applied tier 4: 10% storage bonus`);
        break;
      }
      case 5: {
        // 2 meses grátis
        await supabase.from('user_benefits').insert({
          user_id: referrerUserId,
          benefit_tier: 'tier_5_referral_credit',
          benefit_type: 'referral_2_months_free',
          benefit_value: { type: 'free_days', value: 60 },
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        });
        console.log(`Applied tier 5: 2 months free`);
        break;
      }
      case 6: {
        // 12 meses grátis
        await supabase.from('user_benefits').insert({
          user_id: referrerUserId,
          benefit_tier: 'tier_6_referral_credit',
          benefit_type: 'referral_12_months_free',
          benefit_value: { type: 'free_days', value: 365 },
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        });
        console.log(`Applied tier 6: 12 months free`);
        break;
      }
      default:
        console.log(`No benefits for tier ${tier}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error applying benefits:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
