import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting cleanup of unconfirmed users...');

    // Find users who haven't confirmed their email in 72 hours
    const cutoffDate = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72 hours ago
    
    const { data: unconfirmedUsers, error: fetchError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000 // Adjust as needed
    });

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    if (!unconfirmedUsers?.users) {
      console.log('No users found');
      return new Response(
        JSON.stringify({ message: 'No users found', deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter users who are unconfirmed and older than 72 hours
    const usersToDelete = unconfirmedUsers.users.filter(user => {
      const createdAt = new Date(user.created_at);
      const isOldEnough = createdAt < cutoffDate;
      const isUnconfirmed = !user.email_confirmed_at;
      
      return isOldEnough && isUnconfirmed;
    });

    console.log(`Found ${usersToDelete.length} unconfirmed users to delete`);

    let deletedCount = 0;
    const errors = [];

    // Delete each unconfirmed user
    for (const user of usersToDelete) {
      try {
        console.log(`Deleting unconfirmed user: ${user.email} (ID: ${user.id})`);
        
        // Delete user - this will cascade delete profile due to foreign key
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        
        if (deleteError) {
          console.error(`Failed to delete user ${user.email}:`, deleteError.message);
          errors.push({ userId: user.id, email: user.email, error: deleteError.message });
        } else {
          deletedCount++;
          console.log(`Successfully deleted user: ${user.email}`);
        }
      } catch (error) {
        console.error(`Error processing user ${user.email}:`, error);
        errors.push({ userId: user.id, email: user.email, error: getErrorMessage(error) });
      }
    }

    const result = {
      message: `Cleanup completed. Deleted ${deletedCount} unconfirmed users.`,
      deleted: deletedCount,
      total_found: usersToDelete.length,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Cleanup result:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in cleanup-unconfirmed-users function:", error); // Edge function deployment fix - rebuild v2
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});