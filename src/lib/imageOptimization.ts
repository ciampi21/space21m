/**
 * Image optimization utilities for converting images to WebP format
 * and compressing them for efficient storage
 */

export interface OptimizedImage {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Convert an image file to WebP format with compression
 */
export const convertToWebP = async (
  file: File, 
  quality: number = 0.8,
  maxWidth: number = 1920,
  maxHeight: number = 1920
): Promise<OptimizedImage> => {
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Add timeout to prevent hanging - reduced from 30s to 10s
    const timeout = setTimeout(() => {
      reject(new Error(`WebP conversion timeout for ${file.name}`));
    }, 10000); // 10 second timeout
    
    if (!ctx) {
      clearTimeout(timeout);
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    img.onload = () => {
      try {
        clearTimeout(timeout);
        
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = calculateOptimalDimensions(
          img.naturalWidth, 
          img.naturalHeight, 
          maxWidth, 
          maxHeight
        );
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress the image
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error(`Failed to create WebP blob for ${file.name}`));
              return;
            }
            
            const originalSize = file.size;
            const compressedSize = blob.size;
            const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
            
            // Create optimized file with WebP extension
            const fileName = file.name.replace(/\.[^/.]+$/, '.webp');
            const optimizedFile = new File([blob], fileName, { 
              type: 'image/webp',
              lastModified: Date.now()
            });
            
            resolve({
              file: optimizedFile,
              originalSize,
              compressedSize,
              compressionRatio
            });
          },
          'image/webp',
          quality
        );
      } catch (error) {
        clearTimeout(timeout);
        console.error('Error during WebP conversion:', error);
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      clearTimeout(timeout);
      console.error('Failed to load image for WebP conversion:', error);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    
    try {
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      
      // Clean up object URL after loading
      img.onload = (originalOnload => function() {
        URL.revokeObjectURL(objectUrl);
        return originalOnload.apply(this, arguments);
      })(img.onload);
      
    } catch (error) {
      clearTimeout(timeout);
      console.error('Error creating object URL:', error);
      reject(error);
    }
  });
};

/**
 * Calculate optimal dimensions for image resize
 */
const calculateOptimalDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  let width = originalWidth;
  let height = originalHeight;
  
  // If image is larger than max dimensions, scale down
  if (width > maxWidth || height > maxHeight) {
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio);
    
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  
  return { width, height };
};

/**
 * Check if a file is an image that can be optimized
 */
export const canOptimizeImage = (file: File): boolean => {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'];
  return imageTypes.includes(file.type.toLowerCase());
};

/**
 * Generate a preview URL for any file (image or video)
 */
export const generatePreviewUrl = (file: File): string => {
  return URL.createObjectURL(file);
};

/**
 * Clean up preview URL to prevent memory leaks
 */
export const cleanupPreviewUrl = (url: string): void => {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

/**
 * Batch optimize multiple image files - now with parallel processing
 */
export const optimizeImages = async (
  files: File[],
  onProgress?: (current: number, total: number, currentFile: string) => void
): Promise<OptimizedImage[]> => {
  
  // Process all files in parallel using Promise.allSettled for better error handling
  const processingPromises = files.map(async (file, index) => {
    try {
      if (canOptimizeImage(file)) {
        try {
          const optimized = await convertToWebP(file);
          
          // Update progress after each completion
          if (onProgress) {
            onProgress(index + 1, files.length, file.name);
          }
          
          return optimized;
        } catch (webpError) {
          console.warn(`WebP conversion failed for ${file.name}, using original:`, webpError);
          
          // Update progress even on fallback
          if (onProgress) {
            onProgress(index + 1, files.length, file.name);
          }
          
          // Fallback to original file
          return {
            file,
            originalSize: file.size,
            compressedSize: file.size,
            compressionRatio: 0
          };
        }
      } else {
        // For non-image files (like videos), return as-is
        if (onProgress) {
          onProgress(index + 1, files.length, file.name);
        }
        
        return {
          file,
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 0
        };
      }
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      
      // Update progress even on error
      if (onProgress) {
        onProgress(index + 1, files.length, file.name);
      }
      
      // On error, use original file
      return {
        file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0
      };
    }
  });
  
  // Wait for all optimizations to complete in parallel
  const results = await Promise.allSettled(processingPromises);
  
  // Extract successful results and handle any rejections
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Optimization failed for file ${index}:`, result.reason);
      // Return original file as fallback
      return {
        file: files[index],
        originalSize: files[index].size,
        compressedSize: files[index].size,
        compressionRatio: 0
      };
    }
  });
};