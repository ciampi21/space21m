import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledPost {
  id: string;
  workspace_id: string;
  title: string;
  caption: string;
  platforms: string[];
  scheduled_for: string;
  media_urls: string[];
}

interface PublishResult {
  platform: string;
  success: boolean;
  error?: string;
  platform_post_id?: string;
}

// Publish to Instagram using the dedicated edge function
async function publishToInstagram(
  supabaseUrl: string,
  serviceRoleKey: string,
  postId: string,
  workspaceId: string
): Promise<PublishResult> {
  try {
    console.log(`Attempting to publish post ${postId} to Instagram...`);

    const response = await fetch(
      `${supabaseUrl}/functions/v1/publish-to-instagram`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          post_id: postId,
          workspace_id: workspaceId,
        }),
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log(`Successfully published to Instagram: ${result.instagram_media_id}`);
      return {
        platform: 'Instagram',
        success: true,
        platform_post_id: result.instagram_media_id,
      };
    } else {
      console.error(`Instagram publish failed:`, result.error);
      return {
        platform: 'Instagram',
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    console.error(`Instagram publish error:`, error);
    return {
      platform: 'Instagram',
      success: false,
      error: error.message,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

    console.log(`Processing scheduled posts at ${now.toISOString()}`);

    // Get posts that should be published now (programmed and scheduled for current time)
    const { data: postsToPublish, error: fetchError } = await supabaseClient
      .from("posts")
      .select("*")
      .eq("status", "Programado")
      .lte("scheduled_for", now.toISOString());

    if (fetchError) {
      console.error("Error fetching posts to publish:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch posts" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${postsToPublish?.length || 0} posts to publish`);

    let processedCount = 0;
    let errorCount = 0;
    const publishResults: { postId: string; results: PublishResult[] }[] = [];

    if (postsToPublish && postsToPublish.length > 0) {
      for (const post of postsToPublish) {
        try {
          console.log(`Processing post ${post.id} for workspace ${post.workspace_id}`);
          console.log(`Platforms: ${post.platforms?.join(', ')}`);

          const results: PublishResult[] = [];
          let anySuccess = false;
          let allFailed = true;

          // Process each platform
          for (const platform of post.platforms || []) {
            if (platform === 'Instagram') {
              // Check if workspace has Instagram account with publishing enabled
              const { data: igAccount } = await supabaseClient
                .from('instagram_accounts')
                .select('id, can_publish, username')
                .eq('workspace_id', post.workspace_id)
                .eq('can_publish', true)
                .single();

              if (igAccount) {
                const result = await publishToInstagram(
                  supabaseUrl,
                  serviceRoleKey,
                  post.id,
                  post.workspace_id
                );
                results.push(result);

                if (result.success) {
                  anySuccess = true;
                  allFailed = false;
                }
              } else {
                console.log(`No Instagram account with publishing enabled for workspace ${post.workspace_id}`);
                results.push({
                  platform: 'Instagram',
                  success: false,
                  error: 'No Instagram account configured for publishing',
                });
              }
            } else {
              // For other platforms, just log (future integration)
              console.log(`Platform ${platform} not yet integrated for automatic publishing`);
              results.push({
                platform: platform,
                success: false,
                error: 'Platform not yet integrated',
              });
              allFailed = false; // Don't count unsupported platforms as failures
            }
          }

          publishResults.push({ postId: post.id, results });

          // Determine final status based on results
          let finalStatus: string;
          if (anySuccess) {
            finalStatus = "Postado";
            processedCount++;
          } else if (allFailed && results.length > 0) {
            finalStatus = "Erro";
            errorCount++;
          } else {
            // No supported platforms, just mark as posted
            finalStatus = "Postado";
            processedCount++;
          }

          // Update post status
          const { error: updateError } = await supabaseClient
            .from("posts")
            .update({
              status: finalStatus,
              published_at: anySuccess ? now.toISOString() : null,
              additional_comments: allFailed && results.length > 0
                ? `Auto-publish failed: ${results.map(r => r.error).filter(Boolean).join(', ')}`
                : post.additional_comments,
            })
            .eq("id", post.id);

          if (updateError) {
            console.error(`Error updating post ${post.id}:`, updateError);
          }

          console.log(`Post ${post.id} processed with status: ${finalStatus}`);

        } catch (error) {
          console.error(`Error processing post ${post.id}:`, error);
          errorCount++;

          // Update post to error status
          await supabaseClient
            .from("posts")
            .update({
              status: "Erro",
              additional_comments: `Auto-publish error: ${error.message}`,
            })
            .eq("id", post.id);
        }
      }
    }

    // Get posts that should be moved to "Programado" status (approved and scheduled for future)
    const { data: postsToSchedule, error: scheduleError } = await supabaseClient
      .from("posts")
      .select("*")
      .eq("status", "Aprovado")
      .gt("scheduled_for", now.toISOString())
      .lte("scheduled_for", tenMinutesFromNow.toISOString());

    if (!scheduleError && postsToSchedule && postsToSchedule.length > 0) {
      for (const post of postsToSchedule) {
        try {
          const { error: scheduleUpdateError } = await supabaseClient
            .from("posts")
            .update({ status: "Programado" })
            .eq("id", post.id);

          if (scheduleUpdateError) {
            console.error(`Error scheduling post ${post.id}:`, scheduleUpdateError);
          } else {
            console.log(`Post ${post.id} moved to Programado status`);
          }

        } catch (error) {
          console.error(`Error scheduling post ${post.id}:`, error);
        }
      }
    }

    const result = {
      processed: processedCount,
      errors: errorCount,
      scheduled: postsToSchedule?.length || 0,
      publishResults,
      timestamp: now.toISOString()
    };

    console.log("Processing complete:", result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
