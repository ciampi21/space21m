import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';
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

  // Handle GET requests gracefully (provide HTML fallback with automatic redirect)
  if (req.method === "GET") {
    console.log("GET request received - providing HTML fallback with redirect");
    
    const origin = req.headers.get("origin") || "https://21m-space.lovable.app";
    const redirectUrl = `${origin}/`;
    
    const htmlResponse = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Redirecting to Checkout...</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script>
        console.log('Checkout redirect page loaded');
        
        // Auto-redirect after 2 seconds
        setTimeout(() => {
          console.log('Auto-redirecting to:', '${redirectUrl}');
          window.location.href = '${redirectUrl}';
        }, 2000);
        
        // Try to get stored UTM data and email from prompt
        function startCheckout() {
          const email = prompt('Enter your email to continue with checkout:');
          if (email) {
            const utmData = JSON.parse(localStorage.getItem('21m_utm_data') || '{}');
            
            fetch('${req.url}', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                email: email,
                customerName: email,
                utmData: utmData
              })
            })
            .then(response => response.json())
            .then(data => {
              if (data.url) {
                window.location.href = data.url;
              } else {
                alert('Error: ' + (data.error || 'Invalid response'));
                window.location.href = '${redirectUrl}';
              }
            })
            .catch(error => {
              console.error('Checkout error:', error);
              alert('Connection error. Redirecting...');
              window.location.href = '${redirectUrl}';
            });
          }
        }
      </script>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 50px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          padding: 40px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
          max-width: 500px;
        }
        .spinner {
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top: 3px solid white;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        button {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 15px 30px;
          font-size: 16px;
          border-radius: 8px;
          cursor: pointer;
          margin: 10px;
          transition: background 0.3s;
        }
        button:hover {
          background: #45a049;
        }
        .redirect-btn {
          background: #2196F3;
        }
        .redirect-btn:hover {
          background: #1976D2;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 21M Space</h1>
        <h2>Redirecting to Checkout...</h2>
        <div class="spinner"></div>
        <p>You will be redirected automatically in a few seconds.</p>
        <p>Or choose an option below:</p>
        <button onclick="startCheckout()">💳 Continue to Checkout</button>
        <button class="redirect-btn" onclick="window.location.href='${redirectUrl}'">🏠 Back to Site</button>
      </div>
    </body>
    </html>`;
    
    return new Response(htmlResponse, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      status: 200,
    });
  }

  try {
    console.log("Processing POST request for checkout");
    const { email, customerName, utmData } = await req.json();
    const referralCode = utmData?.referralCode || null;
    
    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Creating early checkout session for:", email, "with UTM data:", utmData);

    // Track the checkout button click event
    if (utmData?.session_id) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseAdmin
        .from('user_acquisition_events')
        .insert({
          event_type: 'checkout_button_click',
          source: utmData.utm_source || 'direct',
          medium: utmData.utm_medium,
          campaign: utmData.utm_campaign,
          referrer_url: utmData.referrer,
          utm_source: utmData.utm_source,
          utm_medium: utmData.utm_medium,
          utm_campaign: utmData.utm_campaign,
          utm_content: utmData.utm_content,
          utm_term: utmData.utm_term,
          page_url: utmData.page_url,
          user_agent: utmData.user_agent,
          session_id: utmData.session_id,
        });

      console.log("Tracked checkout button click for session:", utmData.session_id);
    }

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
          source: "21m_space_early_checkout",
          session_id: utmData?.session_id || '',
          utm_source: utmData?.utm_source || '',
          utm_medium: utmData?.utm_medium || '',
          utm_campaign: utmData?.utm_campaign || '',
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
        referral_code: referralCode,
        session_id: utmData?.session_id || '',
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
          source: "21m_space_early_checkout",
          email: email,
          referral_code: referralCode,
          session_id: utmData?.session_id || '',
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

    console.log("Early checkout session created:", session.id);

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
    console.error("Error creating early checkout session:", error); // Edge function deployment fix - rebuild v3
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});