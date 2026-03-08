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
    const { referralCode, email, acquisitionData } = await req.json();

    console.log('[track-referral] Received request:', {
      referralCode,
      email,
      hasAcquisitionData: !!acquisitionData
    });

    if (!referralCode || !email) {
      throw new Error('Missing required fields');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se código existe
    const { data: codeData, error: codeError } = await supabase
      .from('referral_codes')
      .select('user_id')
      .eq('referral_code', referralCode)
      .eq('is_active', true)
      .single();

    if (codeError || !codeData) {
      console.error('[track-referral] Invalid referral code:', {
        code: referralCode,
        error: codeError?.message
      });
      throw new Error('Invalid referral code');
    }

    console.log('[track-referral] Valid referral code found for user:', codeData.user_id);

    // Criar registro de referral (pending)
    const { error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_user_id: codeData.user_id,
        referred_email: email,
        referral_code: referralCode,
        status: 'pending',
        acquisition_metadata: acquisitionData || {}
      });

    if (insertError) {
      // Se já existe (duplicate), retornar sucesso mesmo assim
      if (insertError.code === '23505') {
        console.log('[track-referral] Referral already exists (duplicate):', email);
        return new Response(
          JSON.stringify({ success: true, message: 'Referral already tracked' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('[track-referral] Error inserting referral:', insertError);
      throw insertError;
    }

    console.log('[track-referral] ✅ Referral successfully tracked:', {
      email,
      referralCode,
      referrer_user_id: codeData.user_id
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[track-referral] ❌ Error in track-referral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
