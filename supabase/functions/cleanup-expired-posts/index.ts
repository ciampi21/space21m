import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      posts: {
        Row: {
          id: string
          workspace_id: string
          expire_at: string | null
          created_at: string
          status: string
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
    console.log('Starting expired posts cleanup...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    // Get request body
    const { workspace_id, dry_run = false, manual_trigger = false } = await req.json().catch(() => ({}));

    console.log(`Cleanup mode: ${dry_run ? 'DRY RUN' : 'LIVE'}`);

    // Find expired posts
    let query = supabase
      .from('posts')
      .select('id, workspace_id, expire_at, created_at, status')
      .not('expire_at', 'is', null)
      .lt('expire_at', new Date().toISOString());

    if (workspace_id) {
      query = query.eq('workspace_id', workspace_id);
    }

    const { data: expiredPosts, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch expired posts: ${fetchError.message}`);
    }

    if (!expiredPosts || expiredPosts.length === 0) {
      console.log('No expired posts found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No expired posts found',
          summary: {
            posts_found: 0,
            posts_deleted: 0,
            dry_run,
            manual_trigger
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Found ${expiredPosts.length} expired posts`);

    // Group posts by workspace and month to ensure analytics are aggregated first
    const postsByWorkspaceMonth = new Map<string, {
      workspace_id: string;
      year: number;
      month: number;
      posts: typeof expiredPosts;
    }>();

    for (const post of expiredPosts) {
      const createdAt = new Date(post.created_at);
      const year = createdAt.getFullYear();
      const month = createdAt.getMonth() + 1;
      const key = `${post.workspace_id}-${year}-${month}`;

      if (!postsByWorkspaceMonth.has(key)) {
        postsByWorkspaceMonth.set(key, {
          workspace_id: post.workspace_id,
          year,
          month,
          posts: []
        });
      }

      postsByWorkspaceMonth.get(key)!.posts.push(post);
    }

    console.log(`Posts grouped into ${postsByWorkspaceMonth.size} workspace-month combinations`);

    const results = [];
    let totalDeleted = 0;

    for (const [key, group] of postsByWorkspaceMonth) {
      try {
        console.log(`Processing ${key}: ${group.posts.length} posts from ${group.year}/${group.month}`);

        // First, ensure analytics are aggregated for this workspace-month
        if (!dry_run) {
          console.log(`Aggregating analytics for workspace ${group.workspace_id}, ${group.year}/${group.month}`);
          
          const { error: aggregateError } = await supabase.rpc('aggregate_monthly_analytics', {
            target_workspace_id: group.workspace_id,
            target_year: group.year,
            target_month: group.month
          });

          if (aggregateError) {
            console.error(`Failed to aggregate analytics for ${key}:`, aggregateError);
            // Continue with deletion even if aggregation fails to prevent indefinite accumulation
          } else {
            console.log(`Analytics aggregated successfully for ${key}`);
          }
        }

        // Delete the expired posts
        if (!dry_run) {
          const postIds = group.posts.map(p => p.id);
          
          const { error: deleteError } = await supabase
            .from('posts')
            .delete()
            .in('id', postIds);

          if (deleteError) {
            console.error(`Failed to delete posts for ${key}:`, deleteError);
            results.push({
              workspace_month: key,
              posts_count: group.posts.length,
              success: false,
              error: deleteError.message
            });
          } else {
            console.log(`Successfully deleted ${group.posts.length} posts for ${key}`);
            totalDeleted += group.posts.length;
            results.push({
              workspace_month: key,
              posts_count: group.posts.length,
              success: true
            });
          }
        } else {
          console.log(`DRY RUN: Would delete ${group.posts.length} posts for ${key}`);
          results.push({
            workspace_month: key,
            posts_count: group.posts.length,
            success: true,
            dry_run: true
          });
        }

      } catch (error) {
        console.error(`Exception processing ${key}:`, error);
        results.push({
          workspace_month: key,
          posts_count: group.posts.length,
          success: false,
          error: getErrorMessage(error)
        });
      }
    }

    console.log(`Cleanup completed. Total posts processed: ${expiredPosts.length}, Deleted: ${totalDeleted}`);

    // Log the cleanup activity
    if (!dry_run) {
      await supabase.from('admin_audit_log').insert({
        admin_user_id: '00000000-0000-0000-0000-000000000000', // System user
        action_type: 'EXPIRED_POSTS_CLEANUP',
        target_resource: 'posts',
        target_id: workspace_id || null,
        details: {
          posts_found: expiredPosts.length,
          posts_deleted: totalDeleted,
          workspace_months_processed: postsByWorkspaceMonth.size,
          manual_trigger,
          results: results
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: dry_run ? 'Expired posts cleanup simulation completed' : 'Expired posts cleanup completed',
        summary: {
          posts_found: expiredPosts.length,
          posts_deleted: dry_run ? 0 : totalDeleted,
          workspace_months_processed: postsByWorkspaceMonth.size,
          dry_run,
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
    console.error('Failed to cleanup expired posts:', error); // Edge function deployment fix - rebuild v2
    return new Response(
      JSON.stringify({
        error: 'Failed to cleanup expired posts',
        details: getErrorMessage(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});