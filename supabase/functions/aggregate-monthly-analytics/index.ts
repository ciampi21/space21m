import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          owner_id: string
          name: string
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting monthly analytics aggregation...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    // Get request body
    const { workspace_id, year, month, manual_trigger = false } = await req.json().catch(() => ({}));

    let workspacesToProcess: { id: string; name: string }[] = [];

    if (workspace_id) {
      // Process specific workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('id, name')
        .eq('id', workspace_id)
        .single();

      if (workspaceError || !workspace) {
        throw new Error(`Workspace not found: ${workspace_id}`);
      }
      workspacesToProcess = [workspace];
    } else {
      // Process all workspaces
      const { data: workspaces, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id, name');

      if (workspacesError) {
        throw new Error(`Failed to fetch workspaces: ${workspacesError.message}`);
      }
      workspacesToProcess = workspaces || [];
    }

    // Default to current month if not specified
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;

    console.log(`Processing ${workspacesToProcess.length} workspaces for ${targetYear}/${targetMonth}`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const workspace of workspacesToProcess) {
      try {
        console.log(`Processing workspace: ${workspace.name} (${workspace.id})`);

        // Call the aggregation function
        const { data, error } = await supabase.rpc('aggregate_monthly_analytics', {
          target_workspace_id: workspace.id,
          target_year: targetYear,
          target_month: targetMonth
        });

        if (error) {
          console.error(`Error aggregating workspace ${workspace.id}:`, error);
          results.push({
            workspace_id: workspace.id,
            workspace_name: workspace.name,
            success: false,
            error: error.message
          });
          errorCount++;
        } else {
          console.log(`Successfully aggregated workspace ${workspace.id}`);
          results.push({
            workspace_id: workspace.id,
            workspace_name: workspace.name,
            success: true
          });
          successCount++;
        }
      } catch (error) {
        console.error(`Exception processing workspace ${workspace.id}:`, error);
        results.push({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          success: false,
          error: getErrorMessage(error)
        });
        errorCount++;
      }
    }

    console.log(`Aggregation completed. Success: ${successCount}, Errors: ${errorCount}`);

    // Log the aggregation activity
    await supabase.from('admin_audit_log').insert({
      admin_user_id: '00000000-0000-0000-0000-000000000000', // System user
      action_type: 'MONTHLY_ANALYTICS_AGGREGATION',
      target_resource: 'analytics',
      target_id: workspace_id || null,
      details: {
        year: targetYear,
        month: targetMonth,
        workspaces_processed: workspacesToProcess.length,
        success_count: successCount,
        error_count: errorCount,
        manual_trigger,
        results: results
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Monthly analytics aggregation completed',
        summary: {
          year: targetYear,
          month: targetMonth,
          workspaces_processed: workspacesToProcess.length,
          success_count: successCount,
          error_count: errorCount,
          manual_trigger
        },
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Failed to aggregate monthly analytics:', error); // Edge function deployment fix
    return new Response(
      JSON.stringify({
        error: 'Failed to aggregate monthly analytics',
        details: getErrorMessage(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});