import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getErrorMessage } from "../_shared/error-utils.ts";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔧 Starting storage inconsistency fix...')

    // Get all users with their current storage and actual storage
    const { data: usersWithStorage, error: queryError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        email,
        storage_used_mb,
        workspaces!workspaces_owner_id_fkey(
          id,
          media_assets!media_assets_workspace_id_fkey(
            size_bytes
          )
        )
      `)

    if (queryError) {
      console.error('Error querying user storage:', queryError)
      throw queryError
    }

    let fixedCount = 0
    const fixes = []

    for (const user of usersWithStorage || []) {
      // Calculate actual storage from workspaces
      let actualStorageMB = 0
      
      if (user.workspaces) {
        for (const workspace of user.workspaces) {
          if (workspace.media_assets) {
            for (const asset of workspace.media_assets) {
              if (asset.size_bytes) {
                actualStorageMB += Math.round(asset.size_bytes / (1024 * 1024))
              }
            }
          }
        }
      }

      // Check if there's a discrepancy
      if (user.storage_used_mb !== actualStorageMB) {
        console.log(`📊 User ${user.email}: stored=${user.storage_used_mb}MB, actual=${actualStorageMB}MB`)
        
        // Update the profile with correct storage
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            storage_used_mb: actualStorageMB,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.user_id)

        if (updateError) {
          console.error(`❌ Failed to update storage for ${user.email}:`, updateError)
        } else {
          console.log(`✅ Fixed storage for ${user.email}: ${user.storage_used_mb}MB → ${actualStorageMB}MB`)
          fixedCount++
          fixes.push({
            email: user.email,
            old_storage: user.storage_used_mb,
            new_storage: actualStorageMB
          })
        }
      }
    }

    console.log(`🎉 Fixed ${fixedCount} storage inconsistencies`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Fixed ${fixedCount} storage inconsistencies`,
        fixes
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('❌ Error fixing storage inconsistencies:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: getErrorMessage(error)
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})