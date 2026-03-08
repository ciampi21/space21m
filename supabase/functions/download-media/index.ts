import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getErrorMessage } from "../_shared/error-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the media URL from query parameters
    const url = new URL(req.url)
    const mediaUrl = url.searchParams.get('url')
    const filename = url.searchParams.get('filename')

    if (!mediaUrl) {
      return new Response(
        JSON.stringify({ error: 'URL parameter is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify user is authenticated
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Downloading media for user ${user.id}: ${mediaUrl}`)

    // Fetch the media file
    const mediaResponse = await fetch(mediaUrl)
    
    if (!mediaResponse.ok) {
      throw new Error(`Failed to fetch media: ${mediaResponse.status} ${mediaResponse.statusText}`)
    }

    // Get the content type from the original response
    const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream'
    
    // Extract filename from URL if not provided
    const finalFilename = filename || mediaUrl.split('/').pop() || 'download'
    
    // Create response with appropriate headers to force download
    const headers = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${finalFilename}"`,
      'Cache-Control': 'no-cache'
    }

    // Stream the media content
    return new Response(mediaResponse.body, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('Download error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to download media',
        details: getErrorMessage(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})