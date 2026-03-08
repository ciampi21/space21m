import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to delete media from R2
async function deleteMediaFromR2(mediaKey: string, env: any): Promise<boolean> {
  try {
    const endpoint = env.CLOUDFLARE_R2_ENDPOINT;
    const accessKeyId = env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = env.CLOUDFLARE_R2_BUCKET_NAME;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
      console.warn('R2 credentials not configured, skipping R2 deletion for:', mediaKey);
      return true; // Consider it successful if R2 is not configured
    }

    const url = `${endpoint}/${bucketName}/${mediaKey}`;
    const dateString = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = dateString.substring(0, 8);

    // Create AWS signature for deletion
    const canonicalRequest = `DELETE\n/${bucketName}/${mediaKey}\n\nhost:${new URL(endpoint).host}\nx-amz-date:${dateString}\n\nhost;x-amz-date\nUNSIGNED-PAYLOAD`;
    
    const encoder = new TextEncoder();
    const canonicalRequestHash = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));
    const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const stringToSign = `AWS4-HMAC-SHA256\n${dateString}\n${dateStamp}/us-east-1/s3/aws4_request\n${canonicalRequestHashHex}`;
    
    // Create signing key
    const kDate = await crypto.subtle.importKey(
      'raw',
      encoder.encode(`AWS4${secretAccessKey}`),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const kDateSign = await crypto.subtle.sign('HMAC', kDate, encoder.encode(dateStamp));
    const kRegion = await crypto.subtle.importKey('raw', kDateSign, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const kRegionSign = await crypto.subtle.sign('HMAC', kRegion, encoder.encode('us-east-1'));
    const kService = await crypto.subtle.importKey('raw', kRegionSign, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const kServiceSign = await crypto.subtle.sign('HMAC', kService, encoder.encode('s3'));
    const kSigning = await crypto.subtle.importKey('raw', kServiceSign, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const kSigningSign = await crypto.subtle.sign('HMAC', kSigning, encoder.encode('aws4_request'));
    
    const signature = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', kSigningSign, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(stringToSign));
    const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/us-east-1/s3/aws4_request,SignedHeaders=host;x-amz-date,Signature=${signatureHex}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Host': new URL(endpoint).host,
        'x-amz-date': dateString,
        'Authorization': authHeader,
      },
    });

    if (response.ok) {
      console.log(`Successfully deleted media from R2: ${mediaKey}`);
      return true;
    } else {
      console.error(`Failed to delete media from R2: ${mediaKey}, status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`Error deleting media from R2: ${mediaKey}`, error);
    return false;
  }
}

interface DeleteAccountRequest {
  confirmEmail: string;
  password: string;
}

interface DeleteAccountResponse {
  success: boolean;
  message: string;
  preservedData?: {
    analyticsEventsCount: number;
    userStatsBackup: any;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    const { confirmEmail, password }: DeleteAccountRequest = await req.json();

    // Verify email matches
    if (confirmEmail !== user.email) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Email confirmation does not match your account email' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify password by attempting to sign in
    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: password
    });

    if (passwordError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid password' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

      console.log(`Starting account deletion process for user: ${user.id}`);

      // Test R2 credentials before proceeding
      const r2Env = {
        CLOUDFLARE_R2_ENDPOINT: Deno.env.get('CLOUDFLARE_R2_ENDPOINT'),
        CLOUDFLARE_R2_ACCESS_KEY_ID: Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID'),
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
        CLOUDFLARE_R2_BUCKET_NAME: Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME'),
      };

      if (!r2Env.CLOUDFLARE_R2_ENDPOINT || !r2Env.CLOUDFLARE_R2_ACCESS_KEY_ID || 
          !r2Env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || !r2Env.CLOUDFLARE_R2_BUCKET_NAME) {
        console.warn('R2 credentials not fully configured, media cleanup may fail');
      } else {
        console.log('R2 credentials configured, proceeding with deletion...');
      }

      // Step 1: Calculate and backup user statistics
    const { data: userStats, error: statsError } = await supabase
      .rpc('calculate_user_stats_before_deletion', { target_user_id: user.id });

    if (statsError) {
      console.error('Error calculating user stats:', statsError);
    }

    // Step 2: Get user profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    // Step 3: Count acquisition events before deletion
    const { count: acquisitionEventsCount, error: countError } = await supabase
      .from('user_acquisition_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Error counting acquisition events:', countError);
    }

    // Step 4: Create backup record in deleted_users table
    if (userStats) {
      // Ensure all values are properly typed and not null
      const backupData = {
        original_user_id: user.id,
        email: profile?.email || user.email || 'unknown@email.com',
        plan_tier: profile?.plan_tier || 'free',
        subscription_status: profile?.subscription_status || 'inactive',
        acquisition_source: profile?.acquisition_source || 'unknown',
        acquisition_medium: profile?.acquisition_medium || 'unknown',
        acquisition_campaign: profile?.acquisition_campaign || 'unknown',
        created_at: profile?.created_at || new Date().toISOString(),
        subscription_active: Boolean(profile?.subscription_active || false),
        days_as_user: Number(userStats.days_as_user || 0),
        was_paying_user: Boolean(userStats.was_paying_user || false),
        total_workspaces_created: Number(userStats.total_workspaces_created || 0),
        total_posts_created: Number(userStats.total_posts_created || 0),
        storage_used_mb: Number(userStats.storage_used_mb || 0)
      };

      console.log('Creating backup record with data:', backupData);
      
      const { error: backupError } = await supabase
        .from('deleted_users')
        .insert(backupData);

      if (backupError) {
        console.error('Error creating backup record:', backupError);
        console.error('Backup data that failed:', backupData);
        // Don't throw here - continue with deletion even if backup fails
        console.warn('Continuing deletion process despite backup failure');
      } else {
        console.log('Successfully created backup record');
      }
    } else {
      console.warn('No user stats available for backup');
    }

    // Step 5: Get all workspaces owned by the user
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('owner_id', user.id);

    if (workspacesError) {
      console.error('Error fetching workspaces:', workspacesError);
    }

    // Step 6: Delete all workspace-related data using the robust delete-workspace-complete function
    if (workspaces && workspaces.length > 0) {
      for (const workspace of workspaces) {
        console.log(`Deleting workspace: ${workspace.id} (${workspace.name})`);
        
        try {
          // Use the delete-workspace-complete function which has robust R2 cleanup
          const { data: deleteResult, error: deleteError } = await supabase.functions.invoke(
            'delete-workspace-complete',
            {
              body: { workspaceId: workspace.id }
            }
          );

          if (deleteError) {
            console.error(`Error calling delete-workspace-complete for ${workspace.id}:`, deleteError);
          } else if (!deleteResult?.success) {
            console.error(`delete-workspace-complete failed for ${workspace.id}:`, deleteResult?.error);
          } else {
            console.log(`Successfully deleted workspace: ${workspace.id} using delete-workspace-complete`);
          }

        } catch (error) {
          console.error(`Failed to delete workspace ${workspace.id}:`, error);
          // Continue with other workspaces even if one fails
        }
      }
    }

    // Step 7: Clean up remaining user data
    
    // 7.1: Update acquisition events to remove user_id (anonymize but preserve) with verification
    console.log('Anonymizing user acquisition events...');
    let acquisitionAnonymized = false;
    let acquisitionRetries = 0;
    const maxRetries = 3;

    while (!acquisitionAnonymized && acquisitionRetries < maxRetries) {
      const { data: acquisitionData, error: acquisitionError, count } = await supabase
        .from('user_acquisition_events')
        .update({ user_id: null })
        .eq('user_id', user.id)
        .select('*');

      if (acquisitionError) {
        console.error(`Error anonymizing acquisition events (attempt ${acquisitionRetries + 1}):`, acquisitionError);
        acquisitionRetries++;
        if (acquisitionRetries < maxRetries) {
          console.log('Retrying acquisition events anonymization in 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        console.log(`Successfully anonymized ${count || 0} acquisition events`);
        acquisitionAnonymized = true;
      }
    }

    if (!acquisitionAnonymized) {
      console.error('Failed to anonymize acquisition events after all retries');
      // Continue with deletion - we'll check for remaining references later
    }

    // 7.2: Delete support tickets
    const { error: ticketsDeleteError } = await supabase
      .from('support_tickets')
      .delete()
      .eq('user_id', user.id);

    if (ticketsDeleteError) {
      console.error('Error deleting support tickets:', ticketsDeleteError);
    }

    // 7.3: Delete invitations
    const { error: invitationsDeleteError } = await supabase
      .from('invitations')
      .delete()
      .eq('invited_by', user.id);

    if (invitationsDeleteError) {
      console.error('Error deleting invitations:', invitationsDeleteError);
    }

    // 7.4: Delete billing details
    const { error: billingDeleteError } = await supabase
      .from('billing_details')
      .delete()
      .eq('user_id', user.id);

    if (billingDeleteError) {
      console.error('Error deleting billing details:', billingDeleteError);
    }

    // 7.5: Delete user profile
    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', user.id);

    if (profileDeleteError) {
      console.error('Error deleting profile:', profileDeleteError);
    }

    // Step 8: Verify no remaining references before deleting user
    console.log('Verifying no remaining user references before deletion...');
    
    // Check for any remaining user_id references in critical tables
    const { data: remainingAcquisition, error: checkAcquisitionError } = await supabase
      .from('user_acquisition_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (checkAcquisitionError) {
      console.error('Error checking remaining acquisition events:', checkAcquisitionError);
    }

    const { data: remainingWorkspaces, error: checkWorkspacesError } = await supabase
      .from('workspaces')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id);

    if (checkWorkspacesError) {
      console.error('Error checking remaining workspaces:', checkWorkspacesError);
    }

    const { data: remainingMembers, error: checkMembersError } = await supabase
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (checkMembersError) {
      console.error('Error checking remaining workspace members:', checkMembersError);
    }

    // Log any remaining references
    if (remainingAcquisition && remainingAcquisition.length > 0) {
      console.warn(`Warning: ${remainingAcquisition.length} acquisition events still reference user ${user.id}`);
    }
    if (remainingWorkspaces && remainingWorkspaces.length > 0) {
      console.warn(`Warning: ${remainingWorkspaces.length} workspaces still reference user ${user.id}`);
    }
    if (remainingMembers && remainingMembers.length > 0) {
      console.warn(`Warning: ${remainingMembers.length} workspace members still reference user ${user.id}`);
    }

    // Step 9: Finally, delete the user from auth
    console.log('Attempting to delete user from auth system...');
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (authDeleteError) {
      console.error('Error deleting user from auth:', authDeleteError);
      console.error('Auth delete error details:', {
        message: authDeleteError.message,
        status: authDeleteError.status,
        code: authDeleteError.code
      });
      
      // If it's a foreign key constraint error, try to identify the problematic table
      if (authDeleteError.message.includes('violates foreign key constraint') || 
          authDeleteError.message.includes('SQLSTATE 23503')) {
        console.error('Foreign key constraint violation detected. This usually means there are still references to the user in the database.');
        
        // Force cleanup of any remaining acquisition events
        if (remainingAcquisition && remainingAcquisition.length > 0) {
          console.log('Attempting force cleanup of remaining acquisition events...');
          const { error: forceAnonError } = await supabase
            .from('user_acquisition_events')
            .update({ user_id: null })
            .eq('user_id', user.id);
          
          if (forceAnonError) {
            console.error('Force anonymization also failed:', forceAnonError);
          } else {
            console.log('Force anonymization successful, retrying user deletion...');
            
            // Retry user deletion once more
            const { error: retryAuthDeleteError } = await supabase.auth.admin.deleteUser(user.id);
            if (retryAuthDeleteError) {
              console.error('Retry user deletion also failed:', retryAuthDeleteError);
              throw new Error('Failed to delete user account after retry');
            } else {
              console.log('User deletion successful on retry');
            }
          }
        } else {
          throw new Error('Failed to delete user account due to foreign key constraints');
        }
      } else {
        throw new Error('Failed to delete user account');
      }
    } else {
      console.log('User deletion from auth successful');
    }

    console.log(`Account deletion completed for user: ${user.id}`);

    const response: DeleteAccountResponse = {
      success: true,
      message: 'Account successfully deleted. Analytics data has been preserved for business insights.',
      preservedData: {
        analyticsEventsCount: acquisitionEventsCount || 0,
        userStatsBackup: userStats
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error deleting account:', error); // Edge function deployment fix
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: getErrorMessage(error) || 'Failed to delete account' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});