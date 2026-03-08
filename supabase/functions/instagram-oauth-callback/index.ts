import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const appUrl = Deno.env.get('APP_URL') || 'https://app.21m.space';

  // Handle webhook verification from Instagram
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    // If it's a webhook verification request
    if (mode && token) {
      console.log('Webhook verification request:', { mode, token, challenge });

      if (mode === 'subscribe' && token === Deno.env.get('WEBHOOK_VERIFY_TOKEN')) {
        console.log('Webhook verified successfully');
        return new Response(challenge, {
          headers: { 'Content-Type': 'text/plain' },
          status: 200,
        });
      } else {
        console.error('Webhook verification failed');
        return new Response('Forbidden', { status: 403 });
      }
    }

    // If it's an OAuth callback (has code parameter)
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return Response.redirect(`${appUrl}/dashboard?instagram_error=${error}`);
    }

    if (code && state) {
      return handleOAuthCallback(code, state, appUrl);
    }

    return new Response('Bad Request', { status: 400 });
  }

  // Handle POST for OAuth callback (some OAuth flows use POST)
  if (req.method === 'POST') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return Response.redirect(`${appUrl}/dashboard?instagram_error=${error}`);
    }

    if (code && state) {
      return handleOAuthCallback(code, state, appUrl);
    }
  }

  return new Response('Method not allowed', { status: 405 });
});

async function handleOAuthCallback(code: string, state: string, appUrl: string) {
  try {
    // Decode state
    const stateData = JSON.parse(atob(state));
    const { user_id, workspace_id } = stateData;

    console.log('Processing OAuth callback for user:', user_id, 'workspace:', workspace_id);

    const appId = Deno.env.get('FACEBOOK_APP_ID');
    const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
    const redirectUri = Deno.env.get('FACEBOOK_REDIRECT_URI');

    if (!appId || !appSecret || !redirectUri) {
      throw new Error('Missing OAuth configuration');
    }

    // Step 1: Exchange code for short-lived user access token (Facebook OAuth)
    console.log('Step 1: Exchanging code for access token...');
    const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    tokenUrl.searchParams.append('client_id', appId);
    tokenUrl.searchParams.append('client_secret', appSecret);
    tokenUrl.searchParams.append('redirect_uri', redirectUri);
    tokenUrl.searchParams.append('code', code);

    const tokenResponse = await fetch(tokenUrl);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error(`Failed to exchange code: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const shortLivedToken = tokenData.access_token;

    console.log('Short-lived token obtained');

    // Step 2: Exchange for long-lived user access token
    console.log('Step 2: Exchanging for long-lived token...');
    const longLivedUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    longLivedUrl.searchParams.append('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.append('client_id', appId);
    longLivedUrl.searchParams.append('client_secret', appSecret);
    longLivedUrl.searchParams.append('fb_exchange_token', shortLivedToken);

    const longLivedResponse = await fetch(longLivedUrl);

    if (!longLivedResponse.ok) {
      const errorText = await longLivedResponse.text();
      console.error('Long-lived token exchange failed:', errorText);
      throw new Error(`Failed to get long-lived token: ${errorText}`);
    }

    const longLivedData = await longLivedResponse.json();
    const userAccessToken = longLivedData.access_token;
    const userTokenExpiresIn = longLivedData.expires_in || 5184000; // Default 60 days

    console.log('Long-lived user token obtained');

    // Step 3: Get user's Facebook Pages
    console.log('Step 3: Fetching Facebook Pages...');
    const pagesUrl = new URL('https://graph.facebook.com/v21.0/me/accounts');
    pagesUrl.searchParams.append('access_token', userAccessToken);
    pagesUrl.searchParams.append('fields', 'id,name,access_token,instagram_business_account');

    const pagesResponse = await fetch(pagesUrl);

    if (!pagesResponse.ok) {
      const errorText = await pagesResponse.text();
      console.error('Pages fetch failed:', errorText);
      throw new Error(`Failed to fetch pages: ${errorText}`);
    }

    const pagesData = await pagesResponse.json();
    console.log('Pages found:', pagesData.data?.length || 0);

    // Step 4: Find page with Instagram Business Account
    let instagramAccount = null;
    let pageInfo = null;

    for (const page of pagesData.data || []) {
      if (page.instagram_business_account) {
        console.log('Found Instagram Business Account on page:', page.name);
        pageInfo = page;
        
        // Step 5: Get Instagram Business Account details
        const igUrl = new URL(`https://graph.facebook.com/v21.0/${page.instagram_business_account.id}`);
        igUrl.searchParams.append('access_token', page.access_token);
        igUrl.searchParams.append('fields', 'id,username,profile_picture_url,followers_count,media_count');

        const igResponse = await fetch(igUrl);

        if (igResponse.ok) {
          instagramAccount = await igResponse.json();
          instagramAccount.page_access_token = page.access_token;
          instagramAccount.page_id = page.id;
          console.log('Instagram account details fetched:', instagramAccount.username);
          break;
        }
      }
    }

    if (!instagramAccount) {
      console.error('No Instagram Business Account found');
      return Response.redirect(`${appUrl}/dashboard?instagram_error=no_business_account`);
    }

    // Step 6: Save to database
    console.log('Step 6: Saving to database...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const expiresAt = new Date(Date.now() + userTokenExpiresIn * 1000);

    const { error: dbError } = await supabase
      .from('instagram_accounts')
      .upsert({
        user_id: user_id,
        workspace_id: workspace_id,
        instagram_user_id: instagramAccount.id,
        instagram_business_account_id: instagramAccount.id,
        username: instagramAccount.username,
        profile_picture_url: instagramAccount.profile_picture_url,
        access_token: userAccessToken,
        page_access_token: instagramAccount.page_access_token,
        page_id: instagramAccount.page_id,
        token_type: 'bearer',
        expires_at: expiresAt.toISOString(),
        account_type: 'BUSINESS',
        can_publish: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id,instagram_user_id',
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log('Instagram Business Account saved successfully:', instagramAccount.username);

    // Redirect back to app with success
    return Response.redirect(`${appUrl}/dashboard?instagram_success=true&username=${encodeURIComponent(instagramAccount.username)}`);

  } catch (error) {
    console.error('Error in instagram-oauth-callback:', error);
    return Response.redirect(`${appUrl}/dashboard?instagram_error=${encodeURIComponent(error.message)}`);
  }
}
