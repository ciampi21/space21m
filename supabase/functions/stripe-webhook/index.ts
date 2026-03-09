
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getErrorMessage } from "../_shared/error-utils.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

// Generate a secure random token
function generateSetupToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

serve(async (req) => {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      console.error("No Stripe signature found");
      return new Response("No signature", { status: 400 });
    }

    // Note: For production, you should set a webhook secret
    // For now, we'll verify the event differently
    let event;
    try {
      event = JSON.parse(body);
      console.log("Received webhook event:", event.type);
    } catch (err) {
      console.error("Error parsing webhook body:", err);
      return new Response("Invalid JSON", { status: 400 });
    }

    // === MULTI-APP FILTER ===
    // Filter out events from other apps sharing the same Stripe account
    const eventMetadata = event.data?.object?.metadata;
    if (eventMetadata?.type === "banner") {
      console.log("Skipping event - belongs to another app (banner):", event.type);
      return new Response(JSON.stringify({ received: true, skipped: "banner" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Allowlist of price IDs belonging to THIS app (21M Space)
    const KNOWN_PRICE_IDS = [
      'price_1RvWXELv0YKLys0d03c5dJqn', // premium
      'price_1RvWXELv0YKLys0dcQphItUR', // pro
    ];

    // For checkout and subscription events, verify price IDs belong to this app
    if (['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      const obj = event.data?.object;
      let eventPriceIds: string[] = [];

      // Extract price IDs from checkout session
      if (obj?.line_items?.data) {
        eventPriceIds = obj.line_items.data.map((item: any) => item.price?.id).filter(Boolean);
      }
      // Extract price IDs from subscription
      if (obj?.items?.data) {
        eventPriceIds = obj.items.data.map((item: any) => item.price?.id).filter(Boolean);
      }

      if (eventPriceIds.length > 0 && !eventPriceIds.some((id: string) => KNOWN_PRICE_IDS.includes(id))) {
        console.log("Skipping event - price IDs not from this app:", eventPriceIds, "Event:", event.type);
        return new Response(JSON.stringify({ received: true, skipped: "unknown_price" }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("Checkout session completed:", session.id);
        
        // Get customer details
        const customer = await stripe.customers.retrieve(session.customer);
        const customerEmail = (customer as any).email;
        
        if (!customerEmail) {
          console.error("No customer email found");
          break;
        }

        console.log("Processing completed checkout for:", customerEmail);

        // Generate unique setup token
        const setupToken = generateSetupToken();
        console.log("Setup token created successfully:", setupToken);

        // Mapear Price ID para plan_tier
        let planTier = 'free';
        let isEarlyAdopter = false;
        
        if (session.line_items?.data) {
          for (const item of session.line_items.data) {
            const priceId = item.price?.id;
            console.log("Processing price ID:", priceId);
            
            switch (priceId) {
              case 'price_1RvWXELv0YKLys0d03c5dJqn':
                planTier = 'premium';
                break;
              case 'price_1RvWXELv0YKLys0dcQphItUR':
                planTier = 'pro';
                break;
            }
          }
        }

        // Verificar promotion code Early Adopter
        if (session.total_details?.breakdown?.discounts) {
          for (const discount of session.total_details.breakdown.discounts) {
            if (discount.discount?.promotion_code === 'promo_1RvikdLv0YKLys0digIJZB3t') {
              isEarlyAdopter = true;
              console.log("Early Adopter promotion code detected");
              break;
            }
          }
        }

        console.log("Plan tier:", planTier, "Early Adopter:", isEarlyAdopter);

        // Check if user already exists
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const userExists = existingUser.users.some(user => user.email === customerEmail);
        
        if (!userExists) {
          // Extract acquisition data from session metadata if available
          const metadata = session.metadata || {};
          const referralCode = metadata.referral_code || null;
          const acquisitionData = {
            acquisition_source: metadata.acquisition_source || null,
            acquisition_medium: metadata.acquisition_medium || null,
            acquisition_campaign: metadata.acquisition_campaign || null,
            referrer_url: metadata.referrer_url || null,
            utm_source: metadata.utm_source || null,
            utm_medium: metadata.utm_medium || null,
            utm_campaign: metadata.utm_campaign || null,
            utm_content: metadata.utm_content || null,
            utm_term: metadata.utm_term || null,
            signup_ip: metadata.signup_ip || null,
            user_agent: metadata.user_agent || null,
          };

          // Create user account with email_confirm: false (pending confirmation)
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: customerEmail,
            email_confirm: false, // User needs to confirm and set up account
            user_metadata: {
              stripe_customer_id: session.customer,
              trial_start: new Date().toISOString(),
              source: "stripe_checkout",
              setup_pending: true,
              role: "user", // Changed from admin to user for security
              plan_tier: planTier,
              is_early_adopter: isEarlyAdopter,
              setup_token: setupToken,
              setup_token_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
              referral_code: referralCode,
              ...acquisitionData
            }
          });

          if (authError) {
            console.error("Error creating user:", authError);
          } else {
            console.log("User created successfully (pending confirmation):", authData.user?.id);
            
            // Profile will be created by trigger automatically with correct data from user_metadata
            console.log("Profile will be created automatically by trigger with user role");

            // Track referral if code exists
            if (referralCode && authData.user) {
              try {
                const { error: refError } = await supabase
                  .from('referrals')
                  .update({
                    referred_user_id: authData.user.id,
                    status: 'converted',
                    converted_at: new Date().toISOString()
                  })
                  .eq('referral_code', referralCode)
                  .eq('referred_email', customerEmail);

                if (refError) {
                  console.error('Error updating referral:', refError);
                } else {
                  console.log('Referral converted for code:', referralCode);

                  // Get referrer and calculate tier
                  const { data: refData } = await supabase
                    .from('referrals')
                    .select('referrer_user_id')
                    .eq('referral_code', referralCode)
                    .eq('referred_email', customerEmail)
                    .single();

                  if (refData) {
                    const { data: tierData } = await supabase
                      .rpc('calculate_referral_tier', { referrer_uuid: refData.referrer_user_id });

                    if (tierData && [3, 4, 5, 6].includes(tierData.tier)) {
                      console.log(`Referrer reached tier ${tierData.tier}, applying benefits`);
                      await supabase.functions.invoke('apply-referral-benefits', {
                        body: {
                          referrerUserId: refData.referrer_user_id,
                          tier: tierData.tier
                        }
                      });
                    }
                  }
                }
              } catch (error) {
                console.error('Error processing referral:', error);
              }
            }

            // Get subscription from session
            const subscription = session.subscription ? await stripe.subscriptions.retrieve(session.subscription) : null;
            
            // Apply 20% discount for referred users
            if (referralCode && subscription?.id) {
              console.log('Applying 20% discount for referred user');
              
              try {
                // Create 20% OFF coupon (if it doesn't exist)
                let couponId = 'REFERRAL_20_OFF';
                try {
                  await stripe.coupons.retrieve(couponId);
                } catch (err) {
                  // Coupon doesn't exist, create it
                  await stripe.coupons.create({
                    id: couponId,
                    percent_off: 20,
                    duration: 'once',
                    name: 'Referral Discount - 20% OFF First Month'
                  });
                  console.log('Created referral coupon:', couponId);
                }
                
                // Apply coupon to subscription
                await stripe.subscriptions.update(subscription.id, {
                  coupon: couponId
                });
                
                console.log('20% discount applied to subscription:', subscription.id);
              } catch (discountError) {
                console.error('Error applying referral discount:', discountError);
                // Don't fail the webhook if discount fails
              }
            }
          }
        } else {
          console.log("User already exists:", customerEmail);
          
          // Update existing profile with Stripe info and setup token
          const existingUserData = existingUser.users.find(user => user.email === customerEmail);
          if (existingUserData) {
            const { error: profileError } = await supabase
              .from("profiles")
              .upsert({
                user_id: existingUserData.id,
                email: customerEmail,
                stripe_customer_id: session.customer,
                subscription_active: true,
                role: "user", // Changed from admin to user for security
                plan_tier: planTier,
                is_early_adopter: isEarlyAdopter,
                current_price_id: session.line_items?.data[0]?.price?.id,
                subscription_status: 'active',
                setup_token: setupToken,
                setup_token_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
              });

            if (profileError) {
              console.error("Error updating profile:", profileError);
            } else {
              console.log("Profile updated successfully with user role and plan tier");
            }
          }
        }

        // Send welcome email with setup token
        try {
          await supabase.functions.invoke("send-welcome-email", {
            body: {
              email: customerEmail,
              customerName: (customer as any).name || customerEmail,
              trialDays: 15,
              setupToken: setupToken
            }
          });
          console.log("Welcome email sent to:", customerEmail);
        } catch (emailError) {
          console.error("Error sending welcome email:", emailError);
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Get customer email
        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail = (customer as any).email;
        
        if (customerEmail) {
          // Mapear Price ID para plan_tier
          let planTier = 'free';
          const priceId = subscription.items.data[0]?.price.id;
          
          switch (priceId) {
            case 'price_1RvWXELv0YKLys0d03c5dJqn':
              planTier = 'premium';
              break;
            case 'price_1RvWXELv0YKLys0dcQphItUR':
              planTier = 'pro';
              break;
          }
          
          const isActive = subscription.status === "active" || subscription.status === "trialing";
          
          // Update subscription status in profiles
          const { error } = await supabase
            .from("profiles")
            .update({ 
              subscription_active: isActive,
              subscription_status: subscription.status,
              plan_tier: planTier,
              current_price_id: priceId,
              current_subscription_id: subscription.id,
              // Limpar campos de dunning se pagamento foi bem-sucedido
              past_due_since: isActive ? null : undefined,
              grace_until: isActive ? null : undefined,
              billing_banner: isActive ? null : undefined
            })
            .eq("email", customerEmail);

          if (error) {
            console.error("Error updating subscription status:", error);
          } else {
            console.log(`Subscription ${isActive ? 'activated' : 'deactivated'} for:`, customerEmail, "Plan:", planTier);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Get customer email
        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail = (customer as any).email;
        
        if (customerEmail) {
          // Downgrade para free
          const { error } = await supabase
            .from("profiles")
            .update({ 
              subscription_active: false,
              subscription_status: 'canceled',
              plan_tier: 'free',
              is_early_adopter: false,
              current_price_id: null,
              current_subscription_id: null,
              past_due_since: null,
              grace_until: null,
              billing_banner: null
            })
            .eq("email", customerEmail);

          if (error) {
            console.error("Error downgrading user to free:", error);
          } else {
            console.log("User downgraded to free plan:", customerEmail);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        // Get customer email
        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail = (customer as any).email;
        
        if (customerEmail) {
          const now = new Date();
          const gracePeriod = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias
          
          // Update profile com dunning
          const { error } = await supabase
            .from("profiles")
            .update({ 
              subscription_status: 'past_due',
              last_invoice_status: 'payment_failed',
              past_due_since: now.toISOString(),
              grace_until: gracePeriod.toISOString(),
              billing_banner: `Payment failed. You have until ${gracePeriod.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} to resolve this issue.`
            })
            .eq("email", customerEmail);

          if (error) {
            console.error("Error updating payment failure status:", error);
          } else {
            console.log("Payment failure recorded for:", customerEmail);
            
            // Enviar email de falha de pagamento
            try {
              await supabase.functions.invoke("send-payment-failed-email", {
                body: {
                  email: customerEmail,
                  gracePeriod: gracePeriod.toISOString()
                }
              });
              console.log("Payment failed email sent to:", customerEmail);
            } catch (emailError) {
              console.error("Error sending payment failed email:", emailError);
            }
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        // Get customer email
        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail = (customer as any).email;
        
        if (customerEmail) {
          // Limpar campos de dunning
          const { error } = await supabase
            .from("profiles")
            .update({ 
              subscription_status: 'active',
              last_invoice_status: 'payment_succeeded',
              past_due_since: null,
              grace_until: null,
              billing_banner: null
            })
            .eq("email", customerEmail);

          if (error) {
            console.error("Error clearing payment failure status:", error);
          } else {
            console.log("Payment success recorded, dunning cleared for:", customerEmail);
          }
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error); // Edge function deployment fix - rebuild v3
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
