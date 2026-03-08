import { generateVideoThumbnailFromUrl, isVideoUrl, getVideoThumbnailFallback } from '@/lib/videoThumbnails';
import { normalizeMediaUrl } from '@/lib/utils';

export interface MediaThumbnailResult {
  thumbnailUrl: string;
  isVideo: boolean;
  isGenerating?: boolean;
  isLoading?: boolean;
  hasValidThumbnail?: boolean;
}

/**
 * Gets the appropriate thumbnail for a media item
 * Prioritizes: saved thumbnails > dynamically generated > fallback
 */
export const getThumbnailForMedia = async (
  mediaUrl: string,
  savedThumbnails: string[] = [],
  mediaIndex: number = 0
): Promise<MediaThumbnailResult> => {
  const isVideo = isVideoUrl(mediaUrl);
  
  // For images, return the original URL
  if (!isVideo) {
    return {
      thumbnailUrl: mediaUrl,
      isVideo: false
    };
  }

  // For videos, check if we have a saved thumbnail
  const savedThumbnail = savedThumbnails?.[mediaIndex];
  if (savedThumbnail && savedThumbnail.trim() !== '') {
    const normalizedThumbnailUrl = normalizeMediaUrl(savedThumbnail);
    return {
      thumbnailUrl: normalizedThumbnailUrl,
      isVideo: true
    };
  }

  // Try to generate a thumbnail dynamically
  try {
    const generatedThumbnail = await generateVideoThumbnailFromUrl(mediaUrl);
    return {
      thumbnailUrl: generatedThumbnail,
      isVideo: true
    };
  } catch (error) {
    console.warn('Failed to generate video thumbnail:', error);
    // Return fallback SVG for videos
    return {
      thumbnailUrl: getVideoThumbnailFallback(),
      isVideo: true
    };
  }
};

/**
 * Gets thumbnail synchronously for immediate display with proper loading state detection
 * Distinguishes between loading, no thumbnail, and valid thumbnail states
 */
export const getThumbnailSync = (
  mediaUrl: string,
  savedThumbnails: string[] | undefined = [],
  mediaIndex: number = 0
): MediaThumbnailResult => {
  const isVideo = isVideoUrl(mediaUrl);
  
  // For images, return the original URL DIRECTLY
  if (!isVideo) {
    return {
      thumbnailUrl: mediaUrl,
      isVideo: false,
      hasValidThumbnail: true,
      isLoading: false
    };
  }

  // For videos: distinguish between loading and no thumbnail
  // If savedThumbnails is undefined, data is still loading
  if (savedThumbnails === undefined) {
    return {
      thumbnailUrl: '', // Empty URL indicates loading state
      isVideo: true,
      isLoading: true,
      hasValidThumbnail: false
    };
  }

  // Check if we have a saved thumbnail
  const savedThumbnail = savedThumbnails?.[mediaIndex];
  
  if (savedThumbnail && savedThumbnail.trim() !== '') {
    const normalizedThumbnailUrl = normalizeMediaUrl(savedThumbnail);
    return {
      thumbnailUrl: normalizedThumbnailUrl,
      isVideo: true,
      hasValidThumbnail: true,
      isLoading: false
    };
  }

  // Thumbnail array exists but is empty or invalid - genuine no thumbnail case
  const fallbackUrl = getVideoThumbnailFallback();
  return {
    thumbnailUrl: fallbackUrl,
    isVideo: true,
    hasValidThumbnail: false,
    isLoading: false
  };
};