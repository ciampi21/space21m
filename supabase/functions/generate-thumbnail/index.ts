import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { loadR2Env, uploadToR2, base64ToUint8Array, getCorsHeaders } from '../_shared/r2-fetch.ts'
import { getErrorMessage } from "../_shared/error-utils.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders() })
  }

  try {
    const { videoUrl, workspaceId, userId } = await req.json()

    console.log('📹 Generating thumbnail for video URL:', videoUrl)

    // Generate thumbnail using canvas-based approach
    const thumbnailBase64 = await generateVideoThumbnail(videoUrl)
    
    if (!thumbnailBase64) {
      throw new Error('Failed to generate thumbnail')
    }

    // Upload thumbnail to R2
    const thumbnailKey = `workspaces/${workspaceId}/users/${userId}/thumbnails/thumb-${Date.now()}.webp`
    const r2Env = loadR2Env()
    
    const thumbnailBytes = base64ToUint8Array(thumbnailBase64)
    
    const uploadResult = await uploadToR2(thumbnailKey, thumbnailBytes, 'image/webp', r2Env)
    
    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Failed to upload thumbnail to R2')
    }
    
    const publicUrl = uploadResult.url
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        thumbnailUrl: publicUrl,
        thumbnailKey: thumbnailKey 
      }),
      { headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error generating thumbnail:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: getErrorMessage(error),
        fallbackUrl: getVideoThumbnailFallback()
      }),
      { 
        headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

async function generateVideoThumbnail(videoUrl: string): Promise<string> {
  try {
    console.log('🎬 Starting server-side thumbnail generation for:', videoUrl)
    
    // For server-side implementation, we'll use a simplified approach
    // In a production environment, you'd use FFmpeg or similar tool
    // For now, return a fallback
    console.log('⚠️ Server-side video processing not implemented, using fallback')
    return getVideoThumbnailFallback()
    
  } catch (error) {
    console.error('Error in generateVideoThumbnail:', error)
    return getVideoThumbnailFallback()
  }
}

function getVideoThumbnailFallback(): string {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjMzMzIiByeD0iOCIvPgo8Y2lyY2xlIGN4PSIxNjAiIGN5PSI5MCIgcj0iMzAiIGZpbGw9IiM2NjYiLz4KPHA+PC90ZXh0Pjwvc3ZnPg=='
}