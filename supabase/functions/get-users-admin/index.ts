import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verificar se o usuário é admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar perfil do usuário para verificar se é admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      console.error('Not admin:', { profileError, role: profile?.role })
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin only.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Admin verified, fetching users...')

    // Buscar todos os usuários
    const { data: users, error: usersError } = await supabaseClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('Error fetching users:', usersError)
      throw usersError
    }

    console.log(`Found ${users?.length || 0} users`)

    // Buscar last_sign_in_at do auth.users
    const { data: authUsers, error: authUsersError } = await supabaseClient.auth.admin.listUsers()
    
    if (authUsersError) {
      console.error('Error fetching auth users:', authUsersError)
    }

    // Criar mapa de user_id -> last_sign_in_at
    const lastLoginMap = new Map(
      (authUsers?.users || []).map(u => [u.id, u.last_sign_in_at])
    )

    // Para cada usuário, buscar contagens (COM SERVICE ROLE = SEM RLS)
    const usersWithCounts = await Promise.all(
      (users || []).map(async (user) => {
        // Get plan limits
        const { data: planLimits } = await supabaseClient
          .from('plan_limits')
          .select('max_owned_workspaces, storage_total_mb, max_guest_memberships')
          .eq('plan_tier', user.plan_tier)
          .single()

        // Count owned workspaces (SEM RLS!)
        const { count: workspaceCount } = await supabaseClient
          .from('workspaces')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', user.user_id)

        // Count guest memberships (SEM RLS!)
        const { count: guestMembershipCount } = await supabaseClient
          .from('workspace_members')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.user_id)
          .eq('workspace_role', 'guest')

        console.log(`User ${user.email}: ${workspaceCount} workspaces, ${user.storage_used_mb}MB storage`)

        return {
          ...user,
          last_sign_in_at: lastLoginMap.get(user.user_id) || null,
          storage_used_mb: user.storage_used_mb || 0,
          max_owned_workspaces: planLimits?.max_owned_workspaces || 1,
          storage_total_mb: planLimits?.storage_total_mb || 300,
          max_guest_memberships: planLimits?.max_guest_memberships || 0,
          workspace_count: workspaceCount || 0,
          guest_membership_count: guestMembershipCount || 0,
        }
      })
    )

    console.log('Successfully processed all users')

    return new Response(
      JSON.stringify({ users: usersWithCounts }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error in get-users-admin:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
