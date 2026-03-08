// Cloudflare R2 upload utilities
import { supabase } from '@/integrations/supabase/client';

export interface UploadResult {
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Upload file directly to R2 using presigned URL
 * This is the NEW recommended method - much faster and more reliable
 */
export const uploadToCloudflareR2Direct = async (
  file: File,
  workspaceId: string,
  userId: string,
  postId: string,
  onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
): Promise<UploadResult> => {
  try {
    console.log(`🚀 [Direct Upload] Starting for ${file.name} (${file.size} bytes)`);
    
    // Generate unique key
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop() || '';
    const key = `workspaces/${workspaceId}/media/${timestamp}-${randomStr}.${extension}`;
    
    console.log(`📝 [Direct Upload] Key: ${key}`);
    
    // Step 1: Get presigned upload URL from edge function
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    console.log(`🔑 [Direct Upload] Requesting presigned URL...`);
    const urlResponse = await supabase.functions.invoke('get-r2-upload-url', {
      body: {
        key,
        contentType: file.type,
        contentLength: file.size
      }
    });

    if (urlResponse.error) {
      throw new Error(`Failed to get upload URL: ${urlResponse.error.message}`);
    }

    const { uploadUrl, publicUrl } = urlResponse.data;
    console.log(`✅ [Direct Upload] Got presigned URL`);

    // Step 2: Upload directly to R2 with progress tracking
    console.log(`📤 [Direct Upload] Starting direct upload to R2...`);
    const uploadStartTime = Date.now();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage
          });
          console.log(`📊 [Direct Upload] Progress: ${percentage}% (${event.loaded}/${event.total} bytes)`);
        }
      });

      xhr.addEventListener('load', async () => {
        const uploadDuration = Date.now() - uploadStartTime;
        
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`✅ [Direct Upload] Upload successful in ${uploadDuration}ms`);
          
          // Step 3: Generate file hash and save to media_assets
          try {
            console.log(`🔐 [Direct Upload] Generating file hash...`);
            const arrayBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            console.log(`💾 [Direct Upload] Saving to media_assets...`);
            const { error: assetError } = await supabase
              .from('media_assets')
              .insert({
                workspace_id: workspaceId,
                owner_user_id: userId,
                r2_key: key,
                mime_type: file.type,
                size_bytes: file.size,
                file_hash: fileHash,
                uploaded_by: userId
              });

            if (assetError) {
              console.warn(`⚠️ [Direct Upload] Failed to save media asset:`, assetError);
            }

            // Step 4: Update post with media URL
            console.log(`🔗 [Direct Upload] Updating post with media URL...`);
            const { error: updateError } = await supabase.rpc('append_media_url_to_post', {
              target_post_id: postId,
              new_media_url: publicUrl
            });

            if (updateError) {
              console.error(`❌ [Direct Upload] Failed to update post:`, updateError);
              throw new Error(`Failed to update post: ${updateError.message}`);
            }

            console.log(`✅ [Direct Upload] Complete! 🎉`);
            resolve({
              url: publicUrl,
              key
            });
          } catch (postUpdateError) {
            console.error(`❌ [Direct Upload] Post-upload processing failed:`, postUpdateError);
            reject(postUpdateError);
          }
        } else {
          const uploadDuration = Date.now() - uploadStartTime;
          console.error(`❌ [Direct Upload] Failed with status ${xhr.status} after ${uploadDuration}ms`);
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        const uploadDuration = Date.now() - uploadStartTime;
        console.error(`❌ [Direct Upload] Network error after ${uploadDuration}ms`);
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        console.error(`❌ [Direct Upload] Upload aborted`);
        reject(new Error('Upload aborted'));
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

  } catch (error) {
    console.error('❌ [Direct Upload] Error:', error);
    return {
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
};

/**
 * OLD METHOD: Upload file asynchronously via edge function
 * DEPRECATED: Use uploadToCloudflareR2Direct instead for better performance
 */
export const uploadToCloudflareR2Async = async (
  file: File,
  workspaceId: string,
  userId: string,
  postId: string
): Promise<UploadResult> => {
  const startTime = Date.now();
  console.log('🚀 [UPLOAD-START] Iniciando upload assíncrono:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    postId,
    workspaceId,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Generate unique file key
    console.log('📝 [UPLOAD-STEP-1] Gerando key única do arquivo...');
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const key = `workspaces/${workspaceId}/media/${fileName}`;
    console.log('✅ [UPLOAD-STEP-1] Key gerada:', key);

    // Convert file to base64 for transfer
    console.log('📝 [UPLOAD-STEP-2] Convertendo arquivo para Base64...');
    const base64StartTime = Date.now();
    const base64Data = await fileToBase64(file);
    const base64Duration = Date.now() - base64StartTime;
    console.log('✅ [UPLOAD-STEP-2] Base64 convertido:', {
      sizeInBytes: base64Data.length,
      duration: `${base64Duration}ms`
    });

    // Call async upload edge function (returns immediately)
    console.log('📝 [UPLOAD-STEP-3] Invocando edge function upload-to-r2-async...');
    const invokeStartTime = Date.now();
    
    const { data, error } = await supabase.functions.invoke('upload-to-r2-async', {
      body: {
        key,
        file_data: base64Data,
        mime_type: file.type,
        workspace_id: workspaceId,
        user_id: userId,
        file_size_bytes: file.size,
        post_id: postId
      }
    });
    
    const invokeDuration = Date.now() - invokeStartTime;
    console.log('✅ [UPLOAD-STEP-3] Edge function invocada:', {
      duration: `${invokeDuration}ms`,
      hasError: !!error,
      hasData: !!data
    });

    if (error) {
      console.error('❌ [UPLOAD-ERROR] Edge function retornou erro:', {
        error,
        errorMessage: error.message,
        errorDetails: JSON.stringify(error),
        totalDuration: `${Date.now() - startTime}ms`
      });
      throw new Error(`Failed to start upload: ${error.message || 'Unknown error'}`);
    }

    if (!data?.success) {
      console.error('❌ [UPLOAD-ERROR] Edge function retornou sucesso falso:', {
        data,
        dataError: data?.error,
        totalDuration: `${Date.now() - startTime}ms`
      });
      throw new Error(data?.error || 'Upload initiation failed');
    }

    const totalDuration = Date.now() - startTime;
    console.log('✅ [UPLOAD-SUCCESS] Upload iniciado com sucesso:', {
      fileName: file.name,
      key,
      url: `https://media.21m.space/${key}`,
      totalDuration: `${totalDuration}ms`,
      data
    });
    
    // Return real R2 URL (not placeholder)
    return {
      url: `https://media.21m.space/${key}`,
      key: key
    };

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('❌ [UPLOAD-CRITICAL-ERROR] Erro crítico no upload:', {
      fileName: file.name,
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      totalDuration: `${totalDuration}ms`
    });
    throw error; // Re-throw instead of returning error object
  }
};

// Original synchronous upload (for backward compatibility)
export const uploadToCloudflareR2 = async (
  file: File,
  workspaceId: string,
  userId: string,
  retries: number = 3
): Promise<UploadResult> => {
  console.log('🚀 Starting sync R2 upload for:', file.name, {
    fileSize: file.size,
    fileType: file.type,
    workspaceId,
    userId
  });
  
  try {
    // Generate unique file key
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const key = `workspaces/${workspaceId}/media/${fileName}`;

    // Convert file to base64 for transfer
    const base64Data = await fileToBase64(file);

    // Attempt upload with retry logic
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Call edge function to upload to R2
        const { data, error } = await supabase.functions.invoke('upload-to-r2', {
          body: {
            key,
            file_data: base64Data,
            mime_type: file.type,
            workspace_id: workspaceId,
            user_id: userId,
            file_size_bytes: file.size
          }
        });

        if (error) {
          console.error(`R2 upload error on attempt ${attempt}:`, error);
          
          // If this is the last attempt, return the error
          if (attempt === retries) {
            return { url: '', key: '', error: error.message };
          }
          
          // Wait before retry (exponential backoff)
          const waitTime = Math.min(attempt * 2000, 10000); // Max 10s wait
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        console.log('✅ R2 upload successful for', file.name);
        return {
          url: data.url,
          key: data.key
        };

      } catch (uploadError) {
        console.error(`Upload attempt ${attempt} failed:`, uploadError);
        
        if (attempt === retries) {
          return { url: '', key: '', error: uploadError.message || 'Upload failed' };
        }
        
        const waitTime = Math.min(attempt * 2000, 10000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    return { url: '', key: '', error: 'All upload attempts failed' };

  } catch (error) {
    console.error('Critical error in upload process:', error);
    return { url: '', key: '', error: error.message || 'Upload failed' };
  }
};

// Optimized Base64 conversion using arrayBuffer - much faster than FileReader
const fileToBase64 = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 using btoa - more efficient than FileReader
    let binary = '';
    const chunkSize = 8192; // Process in chunks to avoid call stack issues
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    
    return btoa(binary);
  } catch (error) {
    console.error('Base64 conversion failed:', error);
    throw new Error(`Failed to convert file to base64: ${error.message}`);
  }
};

// Batch convert multiple files to base64 in parallel
export const batchFileToBase64 = async (files: File[]): Promise<string[]> => {
  const conversionPromises = files.map(file => fileToBase64(file));
  const results = await Promise.allSettled(conversionPromises);
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Base64 conversion failed for file ${index}:`, result.reason);
      throw new Error(`Base64 conversion failed for file ${files[index].name}`);
    }
  });
};

// Generate async thumbnail
export const generateThumbnailAsync = async (
  videoUrl: string,
  workspaceId: string,
  userId: string,
  postId: string,
  mediaIndex: number
): Promise<boolean> => {
  try {
    const { error } = await supabase.functions.invoke('generate-thumbnail-async', {
      body: {
        video_url: videoUrl,
        workspace_id: workspaceId,
        user_id: userId,
        post_id: postId,
        media_index: mediaIndex
      }
    });

    return !error;
  } catch (error) {
    console.error('Thumbnail generation initiation failed:', error);
    return false;
  }
};

/**
 * PHASE 5: Retry wrapper for uploads
 */
const uploadWithRetry = async <T>(
  uploadFn: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await uploadFn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Upload attempt ${attempt + 1} failed:`, error);
      
      if (attempt < maxRetries - 1) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => 
          setTimeout(resolve, retryDelay * Math.pow(2, attempt))
        );
      }
    }
  }
  
  throw lastError;
};

/**
 * PHASE 1: NEW - Upload thumbnail directly to R2 using presigned URL
 * This is much faster than the legacy Base64 + edge function method
 */
export const uploadThumbnailToR2Direct = async (
  thumbnailBlob: Blob,
  workspaceId: string,
  userId: string,
  postId: string,
  mediaIndex: number,
  onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
): Promise<UploadResult> => {
  return uploadWithRetry(async () => {
    try {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2);
      const thumbnailKey = `workspaces/${workspaceId}/thumbnails/${postId}-${mediaIndex}-${timestamp}-${randomId}.webp`;
      
      console.log(`📸 [Thumbnail Direct] Starting for ${thumbnailKey}`);
      
      // Step 1: Get presigned URL
      const { data: urlData, error: urlError } = await supabase.functions.invoke('get-r2-upload-url', {
        body: {
          key: thumbnailKey,
          contentType: thumbnailBlob.type,
          contentLength: thumbnailBlob.size
        }
      });

      if (urlError || !urlData?.uploadUrl) {
        throw new Error(urlError?.message || 'Failed to get upload URL for thumbnail');
      }

      console.log(`✅ [Thumbnail Direct] Got presigned URL`);

      // Step 2: Direct upload to R2 with progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress({
              loaded: e.loaded,
              total: e.total,
              percentage: Math.round((e.loaded / e.total) * 100)
            });
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            console.log(`✅ [Thumbnail Direct] Upload successful`);
            resolve({
              url: urlData.publicUrl,
              key: thumbnailKey
            });
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during thumbnail upload'));
        });

        xhr.open('PUT', urlData.uploadUrl, true);
        xhr.setRequestHeader('Content-Type', thumbnailBlob.type);
        xhr.send(thumbnailBlob);
      });
      
    } catch (error) {
      console.error('Thumbnail direct upload error:', error);
      throw error;
    }
  }, 3); // 3 retries with exponential backoff
};

/**
 * OLD METHOD: Upload thumbnail via edge function with Base64
 * DEPRECATED: Use uploadThumbnailToR2Direct instead for better performance
 * Kept as fallback for compatibility
 */
export const uploadThumbnailToR2Legacy = async (
  thumbnailBlob: Blob,
  workspaceId: string,
  userId: string,
  postId: string,
  mediaIndex: number
): Promise<UploadResult> => {
  try {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const thumbnailKey = `workspaces/${workspaceId}/thumbnails/${postId}-${mediaIndex}-${timestamp}-${randomId}.webp`;
    
    // Convert blob to base64
    const arrayBuffer = await thumbnailBlob.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    const response = await supabase.functions.invoke('upload-to-r2', {
      body: {
        key: thumbnailKey,
        file_data: base64Data,
        mime_type: thumbnailBlob.type,
        workspace_id: workspaceId,
        user_id: userId,
        file_size_bytes: thumbnailBlob.size
      }
    });

    if (response.error) {
      console.error('Thumbnail upload failed:', response.error);
      return {
        url: '',
        key: thumbnailKey,
        error: response.error.message
      };
    }

    return {
      url: response.data.url,
      key: thumbnailKey
    };
    
  } catch (error) {
    console.error('Thumbnail upload error:', error);
    return {
      url: '',
      key: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Smart thumbnail upload with fallback
 * Tries direct upload first, falls back to legacy if it fails
 */
export const uploadThumbnailToR2 = async (
  thumbnailBlob: Blob,
  workspaceId: string,
  userId: string,
  postId: string,
  mediaIndex: number,
  onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
): Promise<UploadResult> => {
  try {
    // Try direct upload first
    return await uploadThumbnailToR2Direct(
      thumbnailBlob,
      workspaceId,
      userId,
      postId,
      mediaIndex,
      onProgress
    );
  } catch (directError) {
    console.warn('Direct thumbnail upload failed, trying legacy method:', directError);
    // Fallback to legacy method
    return await uploadThumbnailToR2Legacy(
      thumbnailBlob,
      workspaceId,
      userId,
      postId,
      mediaIndex
    );
  }
};

export const deleteFromCloudflareR2 = async (key: string): Promise<boolean> => {
  try {
    const { error } = await supabase.functions.invoke('delete-from-r2', {
      body: { key }
    });

    if (error) {
      console.error('R2 delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete failed:', error);
    return false;
  }
};

export const testR2Connection = async (): Promise<{success: boolean, error?: string, details?: any}> => {
  try {
    console.log('Testing R2 connection...');
    
    const { data, error } = await supabase.functions.invoke('test-r2-connection');

    if (error) {
      console.error('R2 connection test error:', error);
      return { success: false, error: error.message, details: error };
    }

    console.log('R2 connection test result:', data);
    return { success: data.success, details: data };
    
  } catch (error) {
    console.error('R2 connection test failed:', error);
    return { success: false, error: error.message || 'Connection test failed' };
  }
};

export const testR2FullFunctionality = async (): Promise<{success: boolean, error?: string, details?: any}> => {
  try {
    console.log('Testing R2 full functionality (upload + delete)...');
    
    const { data, error } = await supabase.functions.invoke('r2-full-test');

    if (error) {
      console.error('R2 full test error:', error);
      return { success: false, error: error.message, details: error };
    }

    console.log('R2 full test result:', data);
    return { success: data.success, details: data };
    
  } catch (error) {
    console.error('R2 full test failed:', error);
    return { success: false, error: error.message || 'Full test failed' };
  }
};