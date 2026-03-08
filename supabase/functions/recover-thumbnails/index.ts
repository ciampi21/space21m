import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { getErrorMessage } from "../_shared/error-utils.ts"
import { loadR2Env, uploadToR2, getCorsHeaders } from '../_shared/r2-fetch.ts'

const corsHeaders = getCorsHeaders()

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔄 Starting thumbnail recovery process...')

    // Find posts with video media but missing thumbnails
    const { data: postsWithVideos, error: postsError } = await supabase
      .from('posts')
      .select('id, media_urls, thumbnail_urls, workspace_id, created_by')
      .not('media_urls', 'is', null)
      .neq('media_urls', '{}')

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`)
    }

    console.log(`📋 Found ${postsWithVideos?.length || 0} posts to check`)

    let processed = 0
    let recovered = 0

    for (const post of postsWithVideos || []) {
      try {
        const mediaUrls = post.media_urls || []
        const thumbnailUrls = post.thumbnail_urls || []
        const newThumbnailUrls: string[] = [...thumbnailUrls]
        let needsUpdate = false

        for (let i = 0; i < mediaUrls.length; i++) {
          const mediaUrl = mediaUrls[i]
          
          // Check if this is a video URL
          if (isVideoUrl(mediaUrl)) {
            // Check if thumbnail is missing or empty
            if (!thumbnailUrls[i] || thumbnailUrls[i] === '') {
              console.log(`🎬 Generating missing thumbnail for video in post ${post.id}`)
              
              try {
                // Generate thumbnail for this video
                const thumbnailResult = await generateThumbnailForVideo(
                  mediaUrl, 
                  post.workspace_id, 
                  post.created_by
                )
                
                if (thumbnailResult.success) {
                  newThumbnailUrls[i] = thumbnailResult.thumbnailUrl || ''
                  needsUpdate = true
                  recovered++
                  console.log(`✅ Generated thumbnail for video ${i} in post ${post.id}`)
                } else {
                  console.warn(`⚠️ Failed to generate thumbnail for video ${i} in post ${post.id}:`, thumbnailResult.error)
                }
              } catch (error) {
                console.error(`❌ Error generating thumbnail for video ${i} in post ${post.id}:`, error)
              }
            }
          }
        }

        // Update post if we generated new thumbnails
        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('posts')
            .update({ thumbnail_urls: newThumbnailUrls })
            .eq('id', post.id)

          if (updateError) {
            console.error(`❌ Failed to update post ${post.id}:`, updateError)
          } else {
            console.log(`✅ Updated post ${post.id} with new thumbnails`)
          }
        }

        processed++
      } catch (error) {
        console.error(`❌ Error processing post ${post.id}:`, error)
        processed++
      }
    }

    const summary = {
      success: true,
      processed,
      recovered,
      message: `Processed ${processed} posts, recovered ${recovered} thumbnails`
    }

    console.log('🏁 Thumbnail recovery completed:', summary)

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Thumbnail recovery failed:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: getErrorMessage(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv']
  const urlLower = url.toLowerCase()
  return videoExtensions.some(ext => urlLower.includes(ext)) || url.includes('video')
}

async function generateThumbnailForVideo(
  videoUrl: string, 
  workspaceId: string, 
  userId: string
): Promise<{ success: boolean; thumbnailUrl?: string; error?: string }> {
  try {
    console.log(`🎬 Processing video thumbnail for: ${videoUrl}`)
    
    // Generate fallback thumbnail and upload to R2
    const thumbnailKey = `workspaces/${workspaceId}/users/${userId}/thumbnails/thumb-${Date.now()}.webp`
    const r2Env = loadR2Env()
    
    // Create a simple fallback thumbnail
    const fallbackThumbnail = createFallbackThumbnail()
    const thumbnailBytes = new TextEncoder().encode(atob(fallbackThumbnail.replace('data:image/svg+xml;base64,', '')))
    
    const uploadResult = await uploadToR2(thumbnailKey, thumbnailBytes, 'image/svg+xml', r2Env)
    
    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Failed to upload thumbnail to R2')
    }
    
    const publicUrl = uploadResult.url
    
    return {
      success: true,
      thumbnailUrl: publicUrl
    }
  } catch (error) {
    console.error('Error generating thumbnail:', error)
    return {
      success: false,
      error: getErrorMessage(error)
    }
  }
}

function createFallbackThumbnail(): string {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjMjIyIiByeD0iOCIvPgo8Y2lyY2xlIGN4PSIxNjAiIGN5PSI5MCIgcj0iMzAiIGZpbGw9IiM0NDQiLz4KPHBvbHlnb24gcG9pbnRzPSIxNTAsODAgMTcwLDkwIDE1MCwxMDAiIGZpbGw9IiM4ODgiLz4KPC9zdmc+'
}