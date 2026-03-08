import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Checks if a URL is a Lovable preview/development URL that should not be tracked
 */
function isLovablePreviewUrl(url: string | null): boolean {
  if (!url) return false;
  
  // Check for Lovable preview patterns
  return url.includes('sandbox.lovable.dev') || 
         url.includes('id-preview-') ||
         /https?:\/\/id-preview-.*\.sandbox\.lovable\.dev/.test(url);
}

/**
 * Checks if a URL is an email confirmation or system internal page that should not be tracked
 */
function isSystemInternalUrl(url: string | null): boolean {
  if (!url) return false;
  
  const urlLower = url.toLowerCase();
  
  // Email confirmation URLs
  if (urlLower.includes('token_hash') || 
      urlLower.includes('type=signup') || 
      urlLower.includes('type=email_confirmation') ||
      urlLower.includes('confirmation_url') ||
      urlLower.includes('confirm_signup')) {
    return true;
  }
  
  return false;
}

/**
 * Checks if a referrer is from a webmail service (should be ignored for acquisition)
 */
function isWebmailReferrer(referrer: string | null): boolean {
  if (!referrer) return false;
  
  const referrerLower = referrer.toLowerCase();
  
  return referrerLower.includes('gmail.com') ||
         referrerLower.includes('outlook.com') ||
         referrerLower.includes('outlook.live.com') ||
         referrerLower.includes('hotmail.com') ||
         referrerLower.includes('yahoo.com') ||
         referrerLower.includes('hostgator.com') ||
         referrerLower.includes('webmail') ||
         referrerLower.includes('mail.');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const eventData = await req.json();
    const { 
      user_id,
      event_type,
      source,
      medium,
      campaign,
      referrer_url,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      utm_id,
      page_url,
      user_agent,
      ip_address,
      session_id,
      referralCode
    } = eventData;

    if (!event_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: event_type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Filter out Lovable preview URLs
    if ((page_url && isLovablePreviewUrl(page_url)) || 
        (referrer_url && isLovablePreviewUrl(referrer_url))) {
      console.log('Rejecting acquisition event from Lovable preview page:', { page_url, referrer_url });
      return new Response(
        JSON.stringify({ success: true, message: 'Preview URL filtered out' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Filter out email confirmation and system internal URLs
    if (page_url && isSystemInternalUrl(page_url)) {
      console.log('Rejecting acquisition event from system internal page:', { page_url, event_type });
      return new Response(
        JSON.stringify({ success: true, message: 'System internal URL filtered out' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Filter out webmail referrers (they indicate email confirmations)
    if (referrer_url && isWebmailReferrer(referrer_url)) {
      console.log('Rejecting acquisition event from webmail referrer:', { referrer_url, event_type });
      return new Response(
        JSON.stringify({ success: true, message: 'Webmail referrer filtered out' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Additional validation for page_view events from authenticated users
    if (event_type === 'page_view' && user_id) {
      // Check if this user already has acquisition events
      const { data: existingEvents, error: checkError } = await supabaseAdmin
        .from('user_acquisition_events')
        .select('id')
        .eq('user_id', user_id)
        .limit(1);
      
      if (!checkError && existingEvents && existingEvents.length > 0) {
        console.log('Rejecting duplicate page_view for existing user:', user_id);
        return new Response(
          JSON.stringify({ success: true, message: 'Duplicate page_view filtered out for existing user' }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Detect if this is a referral signup based on referralCode
    let detectedSource = source;
    let finalUtmSource = utm_source;
    let finalUtmMedium = utm_medium;
    let finalUtmCampaign = utm_campaign;
    
    if (referralCode && typeof referralCode === 'string' && referralCode.match(/^[A-Z0-9]{8,15}$/)) {
      console.log('[track-acquisition] Referral code detected:', referralCode);
      
      // Set main source to referral_offer
      detectedSource = 'referral_offer';
      
      // 🆕 HÍBRIDO: Tentar detectar a plataforma real via referrer
      if (!finalUtmSource) {
        const detectedPlatform = await detectAcquisitionSource(referrer_url, null);
        
        // Se detectou uma plataforma real (não 'direct' ou 'referral'), use ela
        if (detectedPlatform && detectedPlatform !== 'direct' && detectedPlatform !== 'referral') {
          finalUtmSource = detectedPlatform;
          console.log('[track-acquisition] Platform detected from referrer:', detectedPlatform);
        } else {
          // Fallback: usar 'referral_offer' quando não consegue detectar
          finalUtmSource = 'referral_offer';
          console.log('[track-acquisition] No platform detected, using referral_offer as utm_source');
        }
      }
      
      // Sempre forçar medium e campaign para referrals
      finalUtmMedium = finalUtmMedium || 'referral';
      finalUtmCampaign = 'referral_offer';
      
      console.log('[track-acquisition] Final referral UTMs:', {
        utm_source: finalUtmSource,
        utm_medium: finalUtmMedium,
        utm_campaign: finalUtmCampaign,
        referralCode
      });
    }
    
    // Detect acquisition source if not provided and not a referral
    detectedSource = detectedSource || await detectAcquisitionSource(referrer_url, utm_source);

    // Insert acquisition event
    const { data: event, error: eventError } = await supabaseAdmin
      .from('user_acquisition_events')
      .insert({
        user_id: user_id || null,
        event_type,
        source: detectedSource,
        medium: finalUtmMedium || medium,
        campaign: finalUtmCampaign || campaign,
        referrer_url,
        utm_source: finalUtmSource,
        utm_medium: finalUtmMedium || utm_medium,
        utm_campaign: finalUtmCampaign || utm_campaign,
        utm_content,
        utm_term,
        utm_id,
        ip_address,
        user_agent,
        page_url,
        session_id,
      })
      .select()
      .single();
    
    console.log('[track-acquisition] Event inserted:', {
      event_type,
      source: detectedSource,
      utm_source: finalUtmSource,
      utm_medium: finalUtmMedium || utm_medium,
      utm_campaign: finalUtmCampaign || utm_campaign,
      referralCode: referralCode || 'none'
    });

    if (eventError) {
      console.error('Error inserting acquisition event:', eventError);
      return new Response(
        JSON.stringify({ error: 'Failed to track acquisition event' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If this is a signup event and we have a user_id, update the profile and connect session events
    if ((event_type === 'signup' || event_type === 'signup_completed') && user_id) {
      // Update user's profile with acquisition data
      // IMPORTANT: utm_campaign is saved here to trigger the 60-day trial activation
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          acquisition_source: detectedSource,
          acquisition_medium: finalUtmMedium || medium,
          acquisition_campaign: finalUtmCampaign || campaign,
          referrer_url,
          utm_source: finalUtmSource,
          utm_medium: finalUtmMedium || utm_medium,
          utm_campaign: finalUtmCampaign || utm_campaign, // CRITICAL: This triggers the trial if utm_campaign=60freetrial or referral_offer
          utm_content,
          utm_term,
          utm_id,
          signup_ip: ip_address,
          user_agent,
        })
        .eq('user_id', user_id);
      
      console.log('[track-acquisition] Profile updated with acquisition data:', {
        user_id,
        acquisition_source: detectedSource,
        utm_source: finalUtmSource,
        utm_medium: finalUtmMedium || utm_medium,
        utm_campaign: finalUtmCampaign || utm_campaign
      });

      if (profileError) {
        console.error('Error updating profile with acquisition data:', profileError);
      }

      // Connect previous anonymous events from this session to the user
      if (session_id) {
        const { error: updateError } = await supabaseAdmin
          .from('user_acquisition_events')
          .update({ user_id })
          .eq('session_id', session_id)
          .is('user_id', null);

        if (updateError) {
          console.error('Error connecting session events to user:', updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, event }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in track-acquisition function:', error); // Edge function deployment fix - rebuild
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function detectAcquisitionSource(referrer: string | null, utmSource: string | null): Promise<string> {
  if (utmSource) return utmSource;
  
  if (!referrer || referrer === '') return 'direct';
  
  const referrerLower = referrer.toLowerCase();
  
  if (referrerLower.includes('google.com')) return 'google';
  if (referrerLower.includes('facebook.com') || referrerLower.includes('fb.com')) return 'facebook';
  if (referrerLower.includes('instagram.com')) return 'instagram';
  if (referrerLower.includes('linkedin.com')) return 'linkedin';
  if (referrerLower.includes('twitter.com') || referrerLower.includes('x.com')) return 'twitter';
  if (referrerLower.includes('producthunt.com')) return 'product_hunt';
  if (referrerLower.includes('lovable.dev') || referrerLower.includes('lovable.app')) return 'lovable';
  if (referrerLower.includes('discord.com') || referrerLower.includes('discord.gg')) return 'discord';
  if (referrerLower.includes('bing.com')) return 'bing';
  if (referrerLower.includes('yahoo.com')) return 'yahoo';
  if (referrerLower.includes('duckduckgo.com')) return 'duckduckgo';
  
  return 'referral';
}