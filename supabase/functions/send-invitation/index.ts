import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to convert HTML to plain text
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

interface InvitationRequest {
  email: string;
  workspace_id: string;
  workspace_name: string;
  invited_by_id: string;
}

// Helper function to determine email language
function getEmailLanguage(userLanguage: string | null, fallback: string = 'en'): 'en' | 'pt' {
  if (!userLanguage) return fallback as 'en' | 'pt';
  const lang = userLanguage.toLowerCase();
  return (lang === 'pt' || lang === 'pt-br') ? 'pt' : 'en';
}

// Email templates for both languages
const emailTemplates = {
  en: {
    notification: {
      subject: (workspaceName: string) => `You've been added to ${workspaceName}`,
      header: '🎉 Welcome to 21M Space!',
      greeting: 'Hello!',
      body: (workspaceName: string) => `You've been added to the workspace <strong>${workspaceName}</strong>.`,
      cta: 'Now you can access the platform and start collaborating with your team!',
      button: 'Access Dashboard',
      footer: 'If you have any questions, our team is always ready to help.',
      tagline: '21M Space - Social Media Content Management'
    },
    invitation: {
      subject: (workspaceName: string) => `Invitation to ${workspaceName} workspace`,
      header: '📨 You\'ve been invited!',
      greeting: 'Hello!',
      body: (workspaceName: string) => `You've received an invitation to join the workspace <strong>${workspaceName}</strong> on the 21M Space platform.`,
      infoBoxTitle: 'What is 21M Space?',
      infoBoxText: 'A complete platform for content management and social media post scheduling.',
      ctaText: 'To accept the invitation and set up your account, click the button below:',
      button: 'Accept Invitation',
      altLinkTitle: 'Alternative link:',
      altLinkText: 'If the button doesn\'t work, copy and paste this link in your browser:',
      expiration: '⏰ This invitation expires in 14 days.',
      ignore: 'If you weren\'t expecting this invitation, you can safely ignore this email.',
      tagline: '21M Space - Social Media Content Management',
      siteUrl: 'app.21m.space'
    }
  },
  pt: {
    notification: {
      subject: (workspaceName: string) => `Você foi adicionado ao workspace ${workspaceName}`,
      header: '🎉 Bem-vindo ao 21M Space!',
      greeting: 'Olá!',
      body: (workspaceName: string) => `Você foi adicionado ao workspace <strong>${workspaceName}</strong>.`,
      cta: 'Agora você pode acessar a plataforma e começar a colaborar com sua equipe!',
      button: 'Acessar Dashboard',
      footer: 'Se você tiver alguma dúvida, nossa equipe está sempre pronta para ajudar.',
      tagline: '21M Space - Gestão de Conteúdo para Redes Sociais'
    },
    invitation: {
      subject: (workspaceName: string) => `Convite para o workspace ${workspaceName}`,
      header: '📨 Você foi convidado!',
      greeting: 'Olá!',
      body: (workspaceName: string) => `Você recebeu um convite para participar do workspace <strong>${workspaceName}</strong> na plataforma 21M Space.`,
      infoBoxTitle: 'O que é o 21M Space?',
      infoBoxText: 'Uma plataforma completa para gestão de conteúdo e agendamento de posts para redes sociais.',
      ctaText: 'Para aceitar o convite e configurar sua conta, clique no botão abaixo:',
      button: 'Aceitar Convite',
      altLinkTitle: 'Link alternativo:',
      altLinkText: 'Se o botão não funcionar, copie e cole este link no seu navegador:',
      expiration: '⏰ Este convite expira em 14 dias.',
      ignore: 'Se você não esperava este convite, pode ignorar este email com segurança.',
      tagline: '21M Space - Gestão de Conteúdo para Redes Sociais',
      siteUrl: 'app.21m.space'
    }
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== SEND INVITATION FUNCTION START ===');
    console.log('Request method:', req.method);
    
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization header present:', !!authHeader);
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Extract JWT token from Bearer header
    const token = authHeader.replace('Bearer ', '');
    console.log('JWT token extracted successfully');

    // Create client with service role for administrative operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate the JWT token manually by verifying the user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    console.log('Token validation result:', { user: user?.email, error: authError?.message });
    
    if (authError || !user) {
      console.error('Auth error details:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: ' + (authError?.message || 'Invalid or expired token') }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('Authenticated user:', user.email);

    // Parse and validate JSON body
    let requestBody: InvitationRequest;
    try {
      const bodyText = await req.text();
      console.log('Raw body text received:', bodyText);
      
      if (!bodyText || bodyText.trim() === '') {
        console.error('Empty request body received');
        return new Response(
          JSON.stringify({ error: 'Request body is empty' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      requestBody = JSON.parse(bodyText);
      console.log('Parsed request body:', requestBody);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body - please check request format' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate required fields
    const { email, workspace_id, workspace_name, invited_by_id } = requestBody;
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: email' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: workspace_id' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    if (!workspace_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: workspace_name' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    if (!invited_by_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: invited_by_id' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format (basic check only)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('Basic email validation passed for:', email);
    console.log('All validations passed for:', { email, workspace_id, workspace_name, invited_by_id });

    // Verify workspace exists and user has permission
    const { data: workspace, error: workspaceError } = await supabaseClient
      .from('workspaces')
      .select('id, name, owner_id')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspace) {
      console.error('Workspace not found:', workspaceError);
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user has permission to invite (owner or admin member)
    const { data: inviterProfile } = await supabaseClient
      .from('profiles')
      .select('id, user_id, email, username')
      .eq('id', invited_by_id)
      .single();

    if (!inviterProfile) {
      return new Response(
        JSON.stringify({ error: 'Inviter profile not found' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const inviterAuthId = inviterProfile.user_id || user.id;
    const isOwner = workspace.owner_id === inviterAuthId;
    const { data: memberPermission } = await supabaseClient
      .from('workspace_members')
      .select('workspace_role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', inviterAuthId)
      .single();

    const isAdmin = memberPermission?.workspace_role === 'owner';

    if (!isOwner && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to invite members to this workspace' }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('Permission check passed. Proceeding with invitation...');

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    // Check if user already exists by email
    const { data: existingProfile } = await supabaseClient
      .from('profiles')
      .select('id, user_id, language')
      .eq('email', email)
      .maybeSingle();

    console.log('Existing user check:', existingProfile ? 'User exists' : 'New user');

    let invitationData;
    
    if (existingProfile) {
      // User exists, add directly to workspace
      console.log('Adding existing user to workspace...');
      
      const { data: existingMember } = await supabaseClient
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('user_id', existingProfile.user_id)
        .single();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'User is already a member of this workspace' }),
          { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { error: insertError } = await supabaseClient
        .from('workspace_members')
        .insert({
          workspace_id,
          user_id: existingProfile.user_id,
          workspace_role: 'guest',
          invited_by: inviterAuthId
        });

      if (insertError) {
        console.error('Error adding user to workspace:', insertError);
        throw new Error('Failed to add user to workspace: ' + insertError.message);
      }

      console.log('User successfully added to workspace, sending notification email...');

      // Send notification email to existing user
      const emailLang = getEmailLanguage(existingProfile.language);
      const template = emailTemplates[emailLang].notification;
      
      const notificationHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
                  .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; margin: 20px 0; font-weight: 600; }
                  .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0;">${template.header}</h1>
                  </div>
                  <div class="content">
                    <p>${template.greeting}</p>
                    <p>${template.body(workspace_name)}</p>
                    <p>${template.cta}</p>
                    <div style="text-align: center;">
                      <a href="https://app.21m.space/dashboard" class="button">${template.button}</a>
                    </div>
                    <p style="margin-top: 30px; font-size: 14px; color: #666;">
                      ${template.footer}
                    </p>
                  </div>
                  <div class="footer">
                    <p>${template.tagline}</p>
                  </div>
                </div>
              </body>
            </html>
          `;
      
      const notificationText = htmlToPlainText(notificationHtml);
      
      try {
        const { error: emailError } = await resend.emails.send({
          from: '21M Space <support@21m.space>',
          to: [email],
          subject: template.subject(workspace_name),
          html: notificationHtml,
          text: notificationText,
          headers: {
            'List-Unsubscribe': '<mailto:unsubscribe@21m.space>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          tags: [
            { name: 'category', value: 'transactional' },
            { name: 'type', value: 'workspace_notification' },
            { name: 'environment', value: 'production' }
          ]
        });

        if (emailError) {
          console.error('❌ RESEND ERROR - Notification email failed');
          console.error('Error object:', JSON.stringify(emailError, null, 2));
          console.error('Email config:', {
            from: '21M Space <support@21m.space>',
            to: email,
            recipient_domain: email.split('@')[1]
          });
          // Don't fail the request if email fails, user was already added
          console.log('⚠️ User added to workspace but notification email failed');
        } else {
          console.log('✅ Notification email sent successfully to:', email);
        }
      } catch (emailError) {
        console.error('Exception sending notification email:', emailError);
        // Don't fail the request if email fails, user was already added
      }

      return new Response(
        JSON.stringify({ success: true, message: 'User added to workspace successfully' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      // User doesn't exist, create invitation and prepare setup token
      console.log('Creating invitation for new user...');
      
      const { data, error } = await supabaseClient
        .from('invitations')
        .insert({
          email,
          workspace_id,
          token: invitationToken,
          invited_by: inviterProfile.id,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating invitation:', error);
        throw new Error('Failed to create invitation: ' + error.message);
      }
      
      invitationData = data;
      console.log('Invitation created successfully, preparing account setup...');

      // Check for existing auth user by email first
      const { data: authUserData } = await supabaseClient.auth.admin.listUsers();
      const existingAuthUser = authUserData?.users?.find(u => u.email === email);
      
      console.log('Existing auth user check:', existingAuthUser ? `Auth user exists: ${existingAuthUser.id}` : 'No auth user found');

      let setupTokenToUse: string | null = null;
      let userId: string;

      if (existingAuthUser) {
        // Auth user exists, check if profile exists
        userId = existingAuthUser.id;
        console.log('Working with existing auth user:', userId);
        
        const { data: checkProfile } = await supabaseClient
          .from('profiles')
          .select('id, user_id, setup_token, setup_token_used_at, setup_token_expires_at')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('Profile check result:', checkProfile ? 'Profile exists' : 'No profile found');

        if (checkProfile) {
          console.log('Profile exists for auth user, managing setup token...');
          // Profile exists, reuse or refresh setup token
          const notUsed = !checkProfile.setup_token_used_at;
          const notExpired = checkProfile.setup_token_expires_at
            ? new Date(checkProfile.setup_token_expires_at) > new Date()
            : true;
          
          if (checkProfile.setup_token && notUsed && notExpired) {
            setupTokenToUse = checkProfile.setup_token;
            console.log('Reusing existing valid setup token');
          } else {
            setupTokenToUse = crypto.randomUUID();
            console.log('Updating setup token for existing profile...');
            const { error: updErr } = await supabaseClient
              .from('profiles')
              .update({
                setup_token: setupTokenToUse,
                setup_token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                setup_token_used_at: null,
              })
              .eq('user_id', userId);
            if (updErr) {
              console.error('Error updating setup token:', updErr);
              throw new Error('Failed to update setup token: ' + updErr.message);
            }
            console.log('Setup token updated successfully');
          }
        } else {
          // Auth user exists but no profile, create profile
          setupTokenToUse = crypto.randomUUID();
          console.log('Creating profile for existing auth user...');
          
          try {
            const { error: insertError } = await supabaseClient
              .from('profiles')
              .insert({
                user_id: userId,
                email,
                setup_token: setupTokenToUse,
                setup_token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              });
            
            if (insertError) {
              console.error('Error creating profile for existing auth user:', insertError);
              throw new Error('Failed to create profile: ' + insertError.message);
            }
            console.log('Profile created successfully for existing auth user');
          } catch (profileError) {
            console.error('Profile creation failed:', profileError);
            throw profileError;
          }
        }
      } else {
        // No auth user exists, create everything from scratch
        console.log('Creating new auth user and profile from scratch...');
        
        try {
          const { data: created, error: createUserError } = await supabaseClient.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { setup_pending: true },
          });
          
          if (createUserError || !created?.user) {
            console.error('Error creating auth user:', createUserError);
            throw new Error('Failed to create auth user: ' + (createUserError?.message || 'Unknown error'));
          }
          
          userId = created.user.id;
          setupTokenToUse = crypto.randomUUID();
          console.log('Auth user created, now creating profile...');
          
          // Try to insert, but handle conflict gracefully
          const { error: insertError } = await supabaseClient
            .from('profiles')
            .insert({
              user_id: userId,
              email,
              setup_token: setupTokenToUse,
              setup_token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            });
          
          if (insertError) {
            // If profile already exists, try to update it instead
            if (insertError.message.includes('already exists') || insertError.code === 'P0001') {
              console.log('Profile already exists, updating setup token instead...');
              const { error: updateError } = await supabaseClient
                .from('profiles')
                .update({
                  setup_token: setupTokenToUse,
                  setup_token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                  setup_token_used_at: null,
                })
                .eq('user_id', userId);
              
              if (updateError) {
                console.error('Error updating existing profile:', updateError);
                throw new Error('Failed to update existing profile: ' + updateError.message);
              }
              console.log('Existing profile updated successfully');
            } else {
              console.error('Error creating profile for new user:', insertError);
              throw new Error('Failed to create profile: ' + insertError.message);
            }
          } else {
            console.log('New profile created successfully');
          }
          console.log('New auth user and profile created successfully');
        } catch (newUserError) {
          console.error('New user creation failed:', newUserError);
          throw newUserError;
        }
      }

      // Send invitation email with invite link that will redirect to setup
      const siteUrl = 'https://app.21m.space';
      const inviteUrl = `${siteUrl}/invite/${invitationToken}`;

      console.log(`Sending invitation email to ${email} for workspace ${workspace_name}`);
      console.log(`Invitation URL: ${inviteUrl}`);

      // Default to English for new users (international audience)
      const emailLang = 'en';
      const template = emailTemplates[emailLang].invitation;

      const invitationHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
                  .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; margin: 20px 0; font-weight: 600; }
                  .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                  .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0;">${template.header}</h1>
                  </div>
                  <div class="content">
                    <p>${template.greeting}</p>
                    <p>${template.body(workspace_name)}</p>
                    
                    <div class="info-box">
                      <p style="margin: 0;"><strong>${template.infoBoxTitle}</strong></p>
                      <p style="margin: 5px 0 0 0;">${template.infoBoxText}</p>
                    </div>

                    <p>${template.ctaText}</p>
                    
                    <div style="text-align: center;">
                      <a href="${inviteUrl}" class="button">${template.button}</a>
                    </div>

                    <p style="font-size: 14px; color: #666; margin-top: 30px;">
                      <strong>${template.altLinkTitle}</strong><br>
                      ${template.altLinkText}<br>
                      <a href="${inviteUrl}" style="color: #667eea; word-break: break-all;">${inviteUrl}</a>
                    </p>

                    <p style="font-size: 14px; color: #666; margin-top: 20px;">
                      ${template.expiration}
                    </p>

                    <p style="margin-top: 30px; font-size: 14px; color: #666;">
                      ${template.ignore}
                    </p>
                  </div>
                  <div class="footer">
                    <p>${template.tagline}</p>
                    <p style="font-size: 12px; color: #999;">${template.siteUrl}</p>
                  </div>
                </div>
              </body>
            </html>
          `;

      const invitationText = htmlToPlainText(invitationHtml);

      try {
        const { error: emailError } = await resend.emails.send({
          from: '21M Space <support@21m.space>',
          to: [email],
          subject: template.subject(workspace_name),
          html: invitationHtml,
          text: invitationText,
          headers: {
            'List-Unsubscribe': '<mailto:unsubscribe@21m.space>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          tags: [
            { name: 'category', value: 'transactional' },
            { name: 'type', value: 'workspace_invitation' },
            { name: 'environment', value: 'production' }
          ]
        });

        if (emailError) {
          console.error('❌ RESEND ERROR - Invitation email failed');
          console.error('Error object:', JSON.stringify(emailError, null, 2));
          console.error('Resend API response:', emailError);
          console.error('Email config:', {
            from: '21M Space <support@21m.space>',
            to: email,
            recipient_domain: email.split('@')[1],
            sender_domain: '21m.space'
          });
          
          // Check if it's a recipient domain issue
          const recipientDomain = email.split('@')[1];
          const errorMessage = emailError.message || JSON.stringify(emailError);
          
          if (errorMessage.includes('Invalid domain') || errorMessage.includes('550 5.4.4')) {
            throw new Error(`Failed to send invitation email. The recipient domain "${recipientDomain}" appears to be invalid or unreachable. Please verify the email address is correct. Error: ${errorMessage}`);
          }
          
          throw new Error(`Failed to send invitation email. Error: ${errorMessage}`);
        }

        console.log('✅ Invitation email sent successfully to:', email);
      } catch (emailError: any) {
        console.error('❌ EXCEPTION sending invitation email');
        console.error('Exception details:', {
          name: emailError?.name,
          message: emailError?.message,
          stack: emailError?.stack
        });
        
        // Re-throw if it's already our formatted error
        if (emailError?.message?.includes('Failed to send invitation email')) {
          throw emailError;
        }
        
        throw new Error(`Failed to send invitation email. Exception: ${emailError?.message || String(emailError)}`);
      }
    }

    console.log("Invitation sent successfully:", { email, workspace_name });

    return new Response(
      JSON.stringify({ success: true, invitation: invitationData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);