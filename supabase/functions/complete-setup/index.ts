import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { token, username, password } = await req.json()

    if (!token || !username || !password) {
      return Response.json(
        { error: 'Token, username e password são obrigatórios' },
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('Completing setup for token:', token)

    // 1. Validate token and get user data
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, email, setup_token_used_at')
      .eq('setup_token', token)
      .single()

    if (profileError || !profile) {
      console.error('Token validation error:', profileError)
      return Response.json(
        { error: 'Token inválido ou não encontrado' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (profile.setup_token_used_at) {
      return Response.json(
        { error: 'Token já foi utilizado' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 2. Update user with password and confirm email using admin client
    const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.user_id,
      {
        password: password,
        email_confirm: true,
        user_metadata: {
          username: username,
          setup_completed: true,
          setup_pending: false
        }
      }
    )

    if (updateUserError) {
      console.error('Error updating user:', updateUserError)
      return Response.json(
        { error: 'Erro ao atualizar usuário: ' + updateUserError.message },
        { status: 500, headers: corsHeaders }
      )
    }

    // 3. Update profile with username and mark token as used
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        username: username,
        setup_token_used_at: new Date().toISOString()
      })
      .eq('user_id', profile.user_id)

    if (updateProfileError) {
      console.error('Error updating profile:', updateProfileError)
      return Response.json(
        { error: 'Erro ao atualizar perfil' },
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('Setup completed successfully for user:', profile.user_id)

    return Response.json(
      { 
        success: true,
        email: profile.email,
        message: 'Conta configurada com sucesso'
      },
      { headers: corsHeaders }
    )

  } catch (error) {
    console.error('Complete setup error:', error) // Edge function deployment fix
    return Response.json(
      { error: 'Erro interno do servidor' },
      { status: 500, headers: corsHeaders }
    )
  }
})