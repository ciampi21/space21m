import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  image_url?: string;
  platforms?: string[];
  collaborators?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('User authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Authenticated user:', user.id); // Edge function deployment fix - rebuild v2

    const { name, description, image_url, platforms, collaborators }: CreateWorkspaceRequest = await req.json();

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Workspace name is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Creating workspace:', { name, description, platforms });

    // Create the workspace using the service role to bypass RLS temporarily
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: workspace, error: workspaceError } = await supabaseService
      .from('workspaces')
      .insert({
        name,
        description,
        image_url,
        platforms: platforms || ['Instagram', 'Facebook', 'LinkedIn'],
        owner_id: user.id
      })
      .select()
      .single();

    if (workspaceError) {
      console.error('Workspace creation error:', workspaceError);
      return new Response(
        JSON.stringify({ error: workspaceError.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Workspace created successfully:', workspace);

    // The owner is automatically added as admin member via database trigger
    // Now handle collaborator invitations if provided
    if (collaborators && collaborators.length > 0) {
      console.log('Processing collaborators:', collaborators);

      // Get owner profile to avoid adding them again and get profile ID
      const { data: ownerProfile } = await supabaseClient
        .from('profiles')
        .select('id, email')
        .eq('user_id', user.id)
        .single();

      if (!ownerProfile) {
        console.error('Owner profile not found');
        return new Response(
          JSON.stringify({ error: 'Owner profile not found' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      for (const email of collaborators) {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          console.error('Invalid email format:', email);
          continue;
        }

        // Skip if this is the owner's email - they're already added by trigger
        if (email.toLowerCase() === ownerProfile.email.toLowerCase()) {
          console.log('Skipping owner email:', email);
          continue;
        }

        // Check if user already exists
        const { data: existingProfile, error: profileError } = await supabaseClient
          .from('profiles')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();

        if (profileError) {
          console.error('Error checking existing profile:', profileError);
          continue;
        }

        if (existingProfile) {
          // User exists, check if already a member first
          const { data: existingMember } = await supabaseClient
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', workspace.id)
            .eq('user_id', existingProfile.user_id)
            .maybeSingle();

          if (existingMember) {
            console.log('User is already a member, skipping:', email);
            continue;
          }

          // Add existing user as member
          console.log('Adding existing user as member:', email);
          const { error: memberError } = await supabaseClient
            .from('workspace_members')
            .insert({
              workspace_id: workspace.id,
              user_id: existingProfile.user_id,
              role: 'guest',
              invited_by: user.id,
              invited_at: new Date().toISOString()
            });

          if (memberError) {
            console.error('Error adding existing user as member:', memberError);
          } else {
            console.log('Successfully added existing user as member:', email);
          }
        } else {
          // User doesn't exist, check for existing invitation first
          const { data: existingInvite } = await supabaseClient
            .from('invitations')
            .select('id')
            .eq('email', email)
            .eq('workspace_id', workspace.id)
            .maybeSingle();

          if (existingInvite) {
            console.log('Invitation already exists for:', email);
            continue;
          }

          // Send invitation to new user
          try {
            console.log('Sending invitation to new user:', email);
            
            const { data: inviteResult, error: inviteError } = await supabaseClient.functions.invoke('send-invitation', {
              body: {
                email,
                workspace_id: workspace.id,
                workspace_name: workspace.name,
                invited_by_id: ownerProfile.id
              }
            });

            if (inviteError) {
              console.error('Error sending invitation via function:', inviteError);
              console.error('Invitation error details:', {
                name: inviteError.name,
                message: inviteError.message,
                context: inviteError.context
              });
              
              // Fallback: create invitation record directly (without email)
              console.log('Attempting fallback invitation creation...');
              const { error: fallbackError } = await supabaseService
                .from('invitations')
                .insert({
                  email,
                  workspace_id: workspace.id,
                  invited_by: ownerProfile.id,
                  token: crypto.randomUUID(),
                  expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
                });
              
              if (fallbackError) {
                console.error('Fallback invitation creation failed for:', email, fallbackError);
              } else {
                console.log('Fallback invitation created successfully for:', email);
              }
            } else {
              console.log('Successfully sent invitation to:', email);
            }
          } catch (sendInviteError) {
            console.error('Failed to send invitation to:', email, sendInviteError);
            
            // Final fallback - create invitation record only
            try {
              console.log('Creating invitation record as final fallback for:', email);
              const { error: recordError } = await supabaseService
                .from('invitations')
                .insert({
                  email,
                  workspace_id: workspace.id,
                  invited_by: ownerProfile.id,
                  token: crypto.randomUUID(),
                  expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
                });
              
              if (recordError) {
                console.error('Final fallback failed:', recordError);
              } else {
                console.log('Final fallback invitation record created for:', email);
              }
            } catch (finalError) {
              console.error('Final fallback exception:', finalError);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ data: workspace, error: null }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});