import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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
    const { email, customerName, utmData } = await req.json();
    
    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Creating checkout session for:", email, "with UTM data:", utmData);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if customer already exists
    const customers = await stripe.customers.list({ 
      email: email, 
      limit: 1 
    });
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("Found existing customer:", customerId);
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: email,
        name: customerName || email,
        metadata: {
          source: "21m_space_trial"
        }
      });
      customerId = customer.id;
      console.log("Created new customer:", customerId);
    }

    // Create checkout session for 15-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "21M Space - 15 Day Trial",
              description: "Social media content management platform",
            },
            unit_amount: 100, // $1.00 for trial
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/auth?canceled=true`,
      metadata: {
        trial_days: "15",
        email: email,
        utm_source: utmData?.utm_source || '',
        utm_medium: utmData?.utm_medium || '',
        utm_campaign: utmData?.utm_campaign || '',
        utm_term: utmData?.utm_term || '',
        utm_content: utmData?.utm_content || '',
        referrer: utmData?.referrer || '',
        page_url: utmData?.page_url || '',
      },
      subscription_data: {
        trial_period_days: 15,
        metadata: {
          source: "21m_space_trial",
          email: email,
          utm_source: utmData?.utm_source || '',
          utm_medium: utmData?.utm_medium || '',
          utm_campaign: utmData?.utm_campaign || '',
          utm_term: utmData?.utm_term || '',
          utm_content: utmData?.utm_content || '',
          referrer: utmData?.referrer || '',
          page_url: utmData?.page_url || '',
        },
      },
    });

    console.log("Checkout session created:", session.id);

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
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});