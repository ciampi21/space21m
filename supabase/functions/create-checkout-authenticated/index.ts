import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for backend operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Create auth client to verify user token
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authentication required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      console.error("User authentication error:", userError);
      throw new Error("User not authenticated or email not available");
    }

    const user = userData.user;
    console.log("Creating checkout for authenticated user:", user.email);

    // Get user profile with acquisition data using service role
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      console.log("Profile error details:", {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint
      });
      
      // Implement fallback - create default acquisition data if profile fetch fails
      console.log("Using fallback acquisition data");
      const defaultProfile = {
        acquisition_source: 'direct',
        acquisition_medium: 'unknown',
        acquisition_campaign: null,
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_term: null,
        utm_content: null,
        referrer_url: null
      };
      
      console.log("Using default acquisition data for checkout");
    } else {
      console.log("User profile acquisition data:", {
        acquisition_source: profile.acquisition_source,
        acquisition_medium: profile.acquisition_medium,
        acquisition_campaign: profile.acquisition_campaign,
        utm_source: profile.utm_source,
        utm_medium: profile.utm_medium,
        utm_campaign: profile.utm_campaign,
        utm_term: profile.utm_term,
        utm_content: profile.utm_content,
        referrer_url: profile.referrer_url
      });
    }

    // Use profile data or fallback
    const acquisitionData = profile || {
      acquisition_source: 'direct',
      acquisition_medium: 'unknown',
      acquisition_campaign: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      referrer_url: null
    };

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if customer already exists
    const customers = await stripe.customers.list({ 
      email: user.email, 
      limit: 1 
    });
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("Found existing customer:", customerId);
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.user_metadata?.name || user.email,
        metadata: {
          source: "authenticated_upgrade",
          user_id: user.id
        }
      });
      customerId = customer.id;
      console.log("Created new customer:", customerId);
    }

    // Check for referral code in profile metadata
    const referralCode = profile?.raw_user_meta_data?.referral_code || null;

    // Create checkout session for premium subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "21M Space - Premium Plan",
              description: "Social media content management platform - Premium features",
            },
            unit_amount: 2900, // $29.00 per month
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/thank-you?upgrade=true`,
      cancel_url: `${req.headers.get("origin")}/profile?upgrade_canceled=true`,
      metadata: {
        user_id: user.id,
        email: user.email,
        source: "authenticated_upgrade",
        referral_code: referralCode || '',
        // Use historical acquisition data from profile or fallback
        acquisition_source: acquisitionData.acquisition_source || '',
        acquisition_medium: acquisitionData.acquisition_medium || '',
        acquisition_campaign: acquisitionData.acquisition_campaign || '',
        utm_source: acquisitionData.utm_source || '',
        utm_medium: acquisitionData.utm_medium || '',
        utm_campaign: acquisitionData.utm_campaign || '',
        utm_term: acquisitionData.utm_term || '',
        utm_content: acquisitionData.utm_content || '',
        referrer: acquisitionData.referrer_url || '',
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          source: "authenticated_upgrade",
          referral_code: referralCode || '',
          // Store acquisition data in subscription metadata too
          acquisition_source: acquisitionData.acquisition_source || '',
          acquisition_medium: acquisitionData.acquisition_medium || '',
          acquisition_campaign: acquisitionData.acquisition_campaign || '',
          utm_source: acquisitionData.utm_source || '',
          utm_medium: acquisitionData.utm_medium || '',
          utm_campaign: acquisitionData.utm_campaign || '',
          utm_term: acquisitionData.utm_term || '',
          utm_content: acquisitionData.utm_content || '',
          referrer: acquisitionData.referrer_url || '',
        },
      },
    });

    console.log("Checkout session created for authenticated user:", session.id);

    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id,
        customerId: customerId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating authenticated checkout session:", error); // Edge function deployment fix - rebuild v3
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});