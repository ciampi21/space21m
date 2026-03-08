/**
 * Video thumbnail generation utilities with localStorage caching and optimization
 */

export interface ThumbnailOptions {
  quality?: number;
  width?: number;
  height?: number;
  timeSeek?: number;
  format?: 'jpeg' | 'webp';
}

export interface ThumbnailResult {
  thumbnailBlob: Blob;
  thumbnailUrl: string;
  width: number;
  height: number;
  size: number;
}

interface CachedThumbnail {
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
  expiresAt: number;
}

const CACHE_KEY_PREFIX = 'video-thumbnail-';
const CACHE_EXPIRY_DAYS = 7;
const MAX_CACHE_ITEMS = 50;

/**
 * Generate cache key from video URL or file
 */
const generateCacheKey = (source: string | File): string => {
  if (typeof source === 'string') {
    return CACHE_KEY_PREFIX + btoa(source).slice(0, 50);
  }
  // For files, use name + size + lastModified as unique identifier
  const fileId = `${source.name}-${source.size}-${source.lastModified}`;
  return CACHE_KEY_PREFIX + btoa(fileId).slice(0, 50);
};

/**
 * Get cached thumbnail from localStorage
 */
const getCachedThumbnail = (source: string | File): string | null => {
  try {
    const cacheKey = generateCacheKey(source);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    const parsedCache: CachedThumbnail = JSON.parse(cached);
    
    // Check if cache is expired
    if (Date.now() > parsedCache.expiresAt) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return parsedCache.dataUrl;
  } catch (error) {
    console.error('Error reading thumbnail cache:', error);
    return null;
  }
};

/**
 * Save thumbnail to localStorage cache
 */
const setCachedThumbnail = (source: string | File, dataUrl: string, width: number, height: number): void => {
  try {
    const cacheKey = generateCacheKey(source);
    const expiresAt = Date.now() + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    const cachedThumbnail: CachedThumbnail = {
      dataUrl,
      width,
      height,
      timestamp: Date.now(),
      expiresAt
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cachedThumbnail));
    
    // Clean up old cache entries if we exceed the limit
    cleanupOldCache();
  } catch (error) {
    console.error('Error caching thumbnail:', error);
  }
};

/**
 * Clean up old cache entries to prevent localStorage bloat
 */
const cleanupOldCache = (): void => {
  try {
    const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    if (cacheKeys.length <= MAX_CACHE_ITEMS) return;
    
    // Get all cache entries with timestamps
    const cacheEntries = cacheKeys.map(key => {
      try {
        const cached: CachedThumbnail = JSON.parse(localStorage.getItem(key) || '{}');
        return { key, timestamp: cached.timestamp || 0 };
      } catch {
        return { key, timestamp: 0 };
      }
    });
    
    // Sort by timestamp (oldest first) and remove excess
    cacheEntries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = cacheEntries.slice(0, cacheEntries.length - MAX_CACHE_ITEMS);
    
    toRemove.forEach(entry => {
      localStorage.removeItem(entry.key);
    });
    
  } catch (error) {
    console.error('Error cleaning up cache:', error);
  }
};

/**
 * PHASE 2: Enhanced thumbnail quality validation
 */
const validateThumbnailQuality = (canvas: HTMLCanvasElement): { 
  isValid: boolean; 
  reason?: string 
} => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { isValid: false, reason: 'No context' };
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  let blackPixels = 0;
  let whitePixels = 0;
  let colorVariance = 0;
  const totalPixels = data.length / 4;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Check for black pixels
    if (r < 30 && g < 30 && b < 30) blackPixels++;
    
    // Check for white pixels
    if (r > 225 && g > 225 && b > 225) whitePixels++;
    
    // Calculate color variance
    colorVariance += Math.abs(r - 128) + Math.abs(g - 128) + Math.abs(b - 128);
  }
  
  const blackRatio = blackPixels / totalPixels;
  const whiteRatio = whitePixels / totalPixels;
  const avgVariance = colorVariance / totalPixels;
  
  // Thumbnail is invalid if:
  // - More than 95% black pixels (relaxed from 80%)
  // - More than 95% white pixels (relaxed from 90%)
  // - Very low color variance (< 5, relaxed from 10)
  
  if (blackRatio > 0.95) {
    return { isValid: false, reason: 'Mostly black' };
  }
  
  if (whiteRatio > 0.95) {
    return { isValid: false, reason: 'Mostly white' };
  }
  
  if (avgVariance < 5) {
    return { isValid: false, reason: 'Low variance' };
  }
  
  return { isValid: true };
};

/**
 * Check if canvas contains mostly black pixels (legacy check)
 */
const isCanvasBlack = (canvas: HTMLCanvasElement): boolean => {
  const validation = validateThumbnailQuality(canvas);
  return !validation.isValid && validation.reason === 'Mostly black';
};

/**
 * Generate optimized video thumbnail from URL with caching and retry mechanism
 */
export const generateVideoThumbnailFromUrl = async (
  videoUrl: string,
  options: ThumbnailOptions = {}
): Promise<string> => {
  const {
    quality = 0.8,
    width = 320,
    height = 180,
    timeSeek = 0.5,
    format = 'webp'
  } = options;

  // Check cache first
  const cachedThumbnail = getCachedThumbnail(videoUrl);
  if (cachedThumbnail) {
    return cachedThumbnail;
  }

  

  // Try without crossOrigin first, then with it if that fails
  const tryGenerateThumbnail = async (useCrossOrigin: boolean): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      let resolved = false;

      // Cleanup function
      const cleanup = () => {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.src = '';
      };

      // Timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (!resolved) {
          cleanup();
          reject(new Error('Timeout'));
        }
      }, 8000);

      const onLoadedMetadata = () => {
        // Video metadata loaded
      };

      const onLoadedData = () => {
        // Validate video is properly loaded
        if (video.readyState < 2) {
          return;
        }
        
        // Ensure we don't seek beyond video duration
        const seekTime = Math.min(timeSeek, video.duration - 0.1);
        video.currentTime = seekTime;
      };

      const onSeeked = () => {
        // Validate video dimensions and state
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          cleanup();
          clearTimeout(timeout);
          reject(new Error('Invalid video dimensions'));
          return;
        }

        if (video.readyState < 2) {
          cleanup();
          clearTimeout(timeout);
          reject(new Error('Video not ready'));
          return;
        }
        
        try {
          // Use multiple animation frames to ensure proper rendering
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // Calculate optimal dimensions maintaining aspect ratio
                const videoAspectRatio = video.videoWidth / video.videoHeight;
                let targetWidth = width;
                let targetHeight = height;

                if (videoAspectRatio > width / height) {
                  targetHeight = Math.round(width / videoAspectRatio);
                } else {
                  targetWidth = Math.round(height * videoAspectRatio);
                }

                // Set canvas dimensions
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                // Clear canvas first
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, targetWidth, targetHeight);

                // Draw video frame to canvas
                ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

                // Check if thumbnail is mostly black
                if (isCanvasBlack(canvas)) {
                  cleanup();
                  clearTimeout(timeout);
                  reject(new Error('Black thumbnail'));
                  return;
                }

                // Convert to data URL
                const dataUrl = canvas.toDataURL(
                  format === 'webp' ? 'image/webp' : 'image/jpeg',
                  quality
                );

                resolved = true;
                cleanup();
                clearTimeout(timeout);

                // Cache the thumbnail
                setCachedThumbnail(videoUrl, dataUrl, targetWidth, targetHeight);

                resolve(dataUrl);
              });
            });
          });
        } catch (error) {
          cleanup();
          clearTimeout(timeout);
          console.error('Error generating thumbnail:', error);
          reject(error);
        }
      };

      const onError = (error: any) => {
        cleanup();
        clearTimeout(timeout);
        console.warn('⚠️ Video load error:', error);
        reject(error);
      };

      // Set up event listeners
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);

      // Configure video for thumbnail generation
      if (useCrossOrigin) {
        video.crossOrigin = 'anonymous';
      }
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      
      // Start loading video
      video.src = videoUrl;
    });
  };

  // Try without crossOrigin first
  try {
    console.log('🔄 Attempting thumbnail generation without crossOrigin');
    return await tryGenerateThumbnail(false);
  } catch (error) {
    console.log('🔄 First attempt failed, trying with crossOrigin');
    try {
      return await tryGenerateThumbnail(true);
    } catch (error2) {
      console.warn('⚠️ Both attempts failed, using fallback');
      return getVideoThumbnailFallback();
    }
  }
};

/**
 * PHASE 2: Helper function to attempt thumbnail generation at specific time
 */
const attemptThumbnailGeneration = async (
  file: File,
  options: ThumbnailOptions = {}
): Promise<ThumbnailResult> => {
  const {
    quality = 0.8,
    width = 320,
    height = 180,
    timeSeek = 0.5,
    format = 'webp'
  } = options;

  // Check cache first
  const cachedThumbnail = getCachedThumbnail(file);
  if (cachedThumbnail) {
    console.log('📸 Using cached thumbnail for file:', file.name);
    // Convert data URL to blob for consistency with interface
    const response = await fetch(cachedThumbnail);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    return {
      thumbnailBlob: blob,
      thumbnailUrl: url,
      width: width,
      height: height,
      size: blob.size
    };
  }

  console.log('🎬 Generating thumbnail for file:', file.name);

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Create object URL for video
    const videoUrl = URL.createObjectURL(file);
    let resolved = false;

    // Cleanup function
    const cleanup = () => {
      URL.revokeObjectURL(videoUrl);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };

    // Timeout to prevent hanging (increased from 10s to 15s)
    const timeout = setTimeout(() => {
      if (!resolved) {
        cleanup();
        console.warn('⏰ Thumbnail generation timeout for file:', file.name);
        reject(new Error('Video thumbnail generation timeout'));
      }
    }, 15000);

    const onLoadedMetadata = () => {
      console.log('📊 File metadata loaded. Duration:', video.duration);
    };

    const onLoadedData = () => {
      console.log('📹 File data loaded, seeking to time:', timeSeek);
      const seekTime = Math.min(timeSeek, video.duration - 0.1);
      video.currentTime = seekTime;
    };

    const onSeeked = () => {
      console.log('⏯️ File seeked to:', video.currentTime, 'Dimensions:', video.videoWidth, 'x', video.videoHeight);
      
      // Validate video dimensions and state
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn('⚠️ Invalid file video dimensions:', video.videoWidth, 'x', video.videoHeight);
        cleanup();
        clearTimeout(timeout);
        reject(new Error('Invalid video dimensions'));
        return;
      }

      if (video.readyState < 2) {
        console.warn('⚠️ File video not ready for drawing, readyState:', video.readyState);
        cleanup();
        clearTimeout(timeout);
        reject(new Error('Video not ready'));
        return;
      }
      
      try {
        // Use multiple animation frames to ensure proper rendering
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Calculate optimal dimensions maintaining aspect ratio
              const videoAspectRatio = video.videoWidth / video.videoHeight;
              let targetWidth = width;
              let targetHeight = height;

              if (videoAspectRatio > width / height) {
                targetHeight = Math.round(width / videoAspectRatio);
              } else {
                targetWidth = Math.round(height * videoAspectRatio);
              }

              // Set canvas dimensions
              canvas.width = targetWidth;
              canvas.height = targetHeight;

              console.log('🎨 Drawing file frame to canvas:', `${targetWidth}x${targetHeight}`);

              // Clear canvas first
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, targetWidth, targetHeight);

              // Draw video frame to canvas
              ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

              // Check if thumbnail is mostly black
              if (isCanvasBlack(canvas)) {
                console.warn('⚠️ Generated file thumbnail appears to be black');
                // For files, we'll still proceed but log the warning
              }

              // Convert to blob
              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    cleanup();
                    clearTimeout(timeout);
                    reject(new Error('Failed to create thumbnail blob'));
                    return;
                  }

                  resolved = true;
                  cleanup();
                  clearTimeout(timeout);

                  const thumbnailUrl = URL.createObjectURL(blob);
                  
                  // Cache the thumbnail as data URL
                  const dataUrl = canvas.toDataURL(
                    format === 'webp' ? 'image/webp' : 'image/jpeg',
                    quality
                  );
                  setCachedThumbnail(file, dataUrl, targetWidth, targetHeight);

                  console.log('✅ File thumbnail generated successfully');
                  
                  resolve({
                    thumbnailBlob: blob,
                    thumbnailUrl,
                    width: targetWidth,
                    height: targetHeight,
                    size: blob.size
                  });
                },
                format === 'webp' ? 'image/webp' : 'image/jpeg',
                quality
              );
            });
          });
        });
      } catch (error) {
        cleanup();
        clearTimeout(timeout);
        console.error('❌ Error generating file thumbnail:', error);
        reject(error);
      }
    };

    const onError = (error: any) => {
      cleanup();
      clearTimeout(timeout);
      console.error('❌ File load error:', error);
      reject(new Error('Failed to load video for thumbnail generation'));
    };

    // Set up event listeners
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    // Configure video
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    
    // Start loading video
    video.src = videoUrl;
  });
};

/**
 * PHASE 2: Generate video thumbnail with retry and quality validation
 * Tries multiple seek times to find a valid frame
 */
export const generateVideoThumbnail = async (
  file: File,
  options: ThumbnailOptions = {}
): Promise<ThumbnailResult> => {
  // Try different seek times to find a good thumbnail (increased from 5 to 8 attempts)
  const seekTimes = [1, 0.5, 2, 3, 5, 0.1, 0.2, 4];
  
  for (let attempt = 0; attempt < seekTimes.length; attempt++) {
    try {
      console.log(`🔄 Thumbnail attempt ${attempt + 1}/${seekTimes.length} at time ${seekTimes[attempt]}s`);
      
      const result = await attemptThumbnailGeneration(file, {
        ...options,
        timeSeek: seekTimes[attempt]
      });
      
      // Validate quality
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = result.width;
        canvas.height = result.height;
        
        // Draw blob to canvas for validation
        const img = new Image();
        const validation = await new Promise<{ isValid: boolean; reason?: string }>((resolve) => {
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            const validation = validateThumbnailQuality(canvas);
            URL.revokeObjectURL(img.src);
            resolve(validation);
          };
          img.onerror = () => {
            URL.revokeObjectURL(img.src);
            resolve({ isValid: false, reason: 'Failed to load image' });
          };
          img.src = result.thumbnailUrl;
        });
        
        if (validation.isValid) {
          console.log(`✅ Valid thumbnail generated on attempt ${attempt + 1}`);
          return result;
        }
        
        console.warn(`⚠️ Attempt ${attempt + 1}: Invalid thumbnail - ${validation.reason}`);
        // Clean up invalid thumbnail
        URL.revokeObjectURL(result.thumbnailUrl);
      } else {
        // No validation possible, accept the result
        return result;
      }
    } catch (error) {
      console.warn(`⚠️ Attempt ${attempt + 1} failed:`, error);
    }
  }
  
  // All attempts failed, use fallback thumbnail instead of throwing error
  console.warn('⚠️ All thumbnail attempts failed, using fallback thumbnail');
  
  // Create blob from fallback SVG
  const fallbackDataUrl = getVideoThumbnailFallback();
  const response = await fetch(fallbackDataUrl);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  
  return {
    thumbnailBlob: blob,
    thumbnailUrl: url,
    width: options.width || 320,
    height: options.height || 180,
    size: blob.size
  };
};

/**
 * Generate thumbnail and upload to Cloudflare R2
 */
export const generateAndUploadThumbnail = async (
  videoFile: File,
  workspaceId: string,
  userId: string,
  options: ThumbnailOptions = {}
): Promise<{ thumbnailUrl: string; thumbnailKey: string }> => {
  // Generate thumbnail
  const thumbnailResult = await generateVideoThumbnail(videoFile, options);
  
  try {
    // Create thumbnail file
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 12);
    const thumbnailFileName = `${timestamp}-${randomString}-thumb.webp`;
    
    const thumbnailFile = new File(
      [thumbnailResult.thumbnailBlob],
      thumbnailFileName,
      { type: 'image/webp' }
    );

    // Upload thumbnail to R2 (using existing upload function)
    const { uploadToCloudflareR2 } = await import('@/lib/cloudflareR2');
    const uploadResult = await uploadToCloudflareR2(thumbnailFile, workspaceId, userId);
    
    if (uploadResult.error) {
      throw new Error(uploadResult.error);
    }

    // Cleanup local URL
    URL.revokeObjectURL(thumbnailResult.thumbnailUrl);

    return {
      thumbnailUrl: uploadResult.url,
      thumbnailKey: uploadResult.key
    };
  } catch (error) {
    // Cleanup on error
    URL.revokeObjectURL(thumbnailResult.thumbnailUrl);
    throw error;
  }
};

/**
 * Generate thumbnails for multiple video files in parallel
 */
export const generateVideoThumbnailsBatch = async (
  videoFiles: File[],
  options?: ThumbnailOptions
): Promise<(ThumbnailResult | null)[]> => {
  const thumbnailPromises = videoFiles.map(async (file, index) => {
    try {
      if (isVideoFile(file)) {
        console.log(`🎬 Generating thumbnail ${index + 1}/${videoFiles.length}: ${file.name}`);
        return await generateVideoThumbnail(file, options);
      }
      return null;
    } catch (error) {
      console.error(`Thumbnail generation failed for ${file.name}:`, error);
      return null;
    }
  });
  
  const results = await Promise.allSettled(thumbnailPromises);
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Thumbnail generation failed for file ${index}:`, result.reason);
      return null;
    }
  });
};

/**
 * Check if URL or file is a video
 */
export const isVideoFile = (source: File | string): boolean => {
  if (typeof source === 'string') {
    return isVideoUrl(source);
  }
  
  const videoTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/mkv'
  ];
  return videoTypes.includes(source.type.toLowerCase());
};

/**
 * Check if URL points to a video file
 */
export const isVideoUrl = (url: string): boolean => {
  console.log('🔍 isVideoUrl checking:', url);
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.mkv'];
  const lowerUrl = url.toLowerCase();
  const result = videoExtensions.some(ext => lowerUrl.includes(ext));
  console.log('🔍 isVideoUrl result:', result, 'for URL:', url);
  return result;
};

/**
 * Get default video thumbnail fallback
 */
export const getVideoThumbnailFallback = (): string => {
  // Return a data URL for a simple video icon/placeholder
  return 'data:image/svg+xml;base64,' + btoa(`
    <svg width="320" height="180" viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="320" height="180" fill="#1a1a1a"/>
      <circle cx="160" cy="90" r="30" fill="#ffffff" fill-opacity="0.8"/>
      <polygon points="150,75 150,105 175,90" fill="#1a1a1a"/>
    </svg>
  `);
};

/**
 * Clear all thumbnail cache (utility function)
 */
export const clearThumbnailCache = (): void => {
  try {
    const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_KEY_PREFIX));
    cacheKeys.forEach(key => localStorage.removeItem(key));
    console.log('🧹 Cleared', cacheKeys.length, 'thumbnail cache entries');
  } catch (error) {
    console.error('Error clearing thumbnail cache:', error);
  }
};