import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { workspaceId } = await req.json();

    if (!workspaceId) {
      throw new Error('workspace_id is required');
    }

    const appId = Deno.env.get('FACEBOOK_APP_ID');
    const redirectUri = Deno.env.get('FACEBOOK_REDIRECT_URI');

    if (!appId || !redirectUri) {
      throw new Error('Missing Instagram OAuth configuration');
    }

    // Generate state parameter with user_id and workspace_id
    const state = btoa(JSON.stringify({
      user_id: user.id,
      workspace_id: workspaceId,
      timestamp: Date.now(),
    }));

    // Build Facebook OAuth URL for Instagram Graph API
    // This flow allows access to Instagram Business/Creator accounts through Facebook Pages
    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    authUrl.searchParams.append('client_id', appId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    // Request permissions for Instagram Business publishing
    authUrl.searchParams.append('scope', [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'instagram_manage_insights',
      'pages_show_list',
      'pages_read_engagement',
      'business_management'
    ].join(','));
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);

    console.log('Generated Facebook OAuth URL for Instagram Graph API:', authUrl.toString());

    return new Response(
      JSON.stringify({ 
        url: authUrl.toString(),
        success: true 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in instagram-oauth-start:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
