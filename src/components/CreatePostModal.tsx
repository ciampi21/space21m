import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Upload, X, Instagram, Facebook, Linkedin, Video, ImageIcon, FileVideo, Play, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';
import { POST_TYPES, PlatformType, PLATFORMS } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { usePostValidation } from '@/hooks/usePostValidation';
import { useStorageCalculation } from '@/hooks/useStorageCalculation';
import { uploadToCloudflareR2, testR2Connection } from '@/lib/cloudflareR2';
import { supabase } from '@/integrations/supabase/client';
import { optimizeImages, generatePreviewUrl, cleanupPreviewUrl, canOptimizeImage } from '@/lib/imageOptimization';
import { DraggableMediaGrid } from './DraggableMediaGrid';
import { useWorkspacePermissions } from '@/hooks/useWorkspacePermissions';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserEntitlements } from '@/hooks/useUserEntitlements';

const createPostSchema = (t: any, isDraft: boolean = false) => z.object({
  publication_date: isDraft ? z.date().optional() : z.date({
    required_error: t('post.dateRequired'),
  }),
  post_type: z.string({
    required_error: t('post.typeRequired'),
  }),
  platforms: z.array(z.string()).min(1, t('post.platformRequired')),
  caption: z.string().optional(),
  additional_comments: z.string().optional(),
}).refine((data) => {
  // For drafts, caption is always optional
  if (isDraft) return true;
  
  // Caption is required for all post types except Stories
  if (data.post_type !== 'Storys' && (!data.caption || data.caption.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: t('post.captionRequired'),
  path: ["caption"],
});

type CreatePostForm = z.infer<ReturnType<typeof createPostSchema>>;

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ open, onOpenChange }) => {
  const { t, i18n } = useTranslation();
  const { currentWorkspace, createPost } = useWorkspace();
  const { profile } = useAuth();
  const { canCreateDrafts } = useWorkspacePermissions();
  const { entitlements } = useUserEntitlements();
  
  // PHASE 3: Enhanced progress tracking state with speed and time
  interface FileProgress {
    fileName: string;
    type: 'media' | 'thumbnail';
    loaded: number;
    total: number;
    percentage: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    estimatedTimeRemaining?: string;
    uploadSpeed?: number; // KB/s
  }

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileThumbnails, setFileThumbnails] = useState<Record<string, string>>({});
  const [filePreviewUrls, setFilePreviewUrls] = useState<Record<string, string>>({});
  const [previewKey, setPreviewKey] = useState<number>(0); // Force re-render key
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [optimizingFiles, setOptimizingFiles] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, FileProgress>>({});
  const [uploadTotal, setUploadTotal] = useState<number>(0);
  const [uploadTimeout, setUploadTimeout] = useState<boolean>(false);
  const { toast } = useToast();
  const { validatePostLimits, showValidationError, checkMediaLimits, checkSchedulingLimits, isValidating } = usePostValidation();
  const { calculateAndUpdateStorageUsage } = useStorageCalculation();

  const postSchema = createPostSchema(t);
  
  const form = useForm<CreatePostForm>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      platforms: [],
      caption: '',
      additional_comments: '',
    },
  });

  // Reset state only when modal closes
  React.useEffect(() => {
    if (!open && !isSubmitting && !optimizingFiles) {
      
      // Clean up preview URLs to prevent memory leaks
      Object.values(filePreviewUrls).forEach(url => cleanupPreviewUrl(url));
      Object.values(fileThumbnails).forEach(url => cleanupPreviewUrl(url));
      
      setSelectedFiles([]);
      setFileThumbnails({});
      setFilePreviewUrls({});
      setPreviewKey(0);
      setOptimizingFiles(false);
      setUploadProgress({});
      setUploadTotal(0);
      setUploadTimeout(false);
      form.reset();
    }
  }, [open, isSubmitting, optimizingFiles]);

  // Enhanced video thumbnail generation using the new utility
  const generateVideoThumbnailFromFile = async (file: File): Promise<string> => {
    try {
      const { generateVideoThumbnail, getVideoThumbnailFallback } = await import('@/lib/videoThumbnails');
      const result = await generateVideoThumbnail(file, {
        quality: 0.9,
        width: 640,
        height: 360,
        timeSeek: 1,
        format: 'webp'
      });
      return result.thumbnailUrl;
    } catch (error) {
      console.error('Failed to generate video thumbnail:', error);
      const { getVideoThumbnailFallback } = await import('@/lib/videoThumbnails');
      return getVideoThumbnailFallback();
    }
  };

  // Sync upload progress to database
  const syncProgressToDatabase = React.useCallback(
    async (postId: string, progress: Record<string, FileProgress>) => {
      const progressValues = Object.values(progress);
      const total = progressValues.length;
      const completed = progressValues.filter(p => p.status === 'completed').length;
      
      const uploadProgressData = {
        total,
        completed,
        files: progressValues.map(p => ({
          name: p.fileName,
          percentage: p.percentage,
          status: p.status,
          uploadSpeed: p.uploadSpeed,
          estimatedTimeRemaining: p.estimatedTimeRemaining
        }))
      };
      
      try {
        const { error } = await supabase
          .from('posts')
          .update({ upload_progress: uploadProgressData })
          .eq('id', postId);
        
        if (error) {
          console.error('Failed to sync upload progress:', error);
        }
      } catch (err) {
        console.error('Exception syncing progress:', err);
      }
    },
    []
  );

  const onSubmit = React.useCallback(async (data: CreatePostForm, isDraft = false) => {
    if (isSubmitting) return;
    if (!currentWorkspace) return;

    const currentFiles = selectedFiles;

    try {
      setIsSubmitting(true);
      console.log('🚀 CreatePost: Starting submission', { 
        isDraft, 
        filesCount: currentFiles.length,
        data: {
          post_type: data.post_type,
          platforms: data.platforms,
          caption: data.caption?.substring(0, 50),
          publication_date: data.publication_date
        }
      });
      
      // Skip validations for drafts
      if (!isDraft) {
        console.log('🔍 CreatePost: Validating post limits...');
        const validation = await validatePostLimits(
          currentWorkspace.id,
          data.publication_date,
          currentFiles.length
        );
        
        if (!validation.allowed) {
          console.log('❌ CreatePost: Validation failed', validation);
          showValidationError(validation);
          setIsSubmitting(false);
          return;
        }
        
        if (!checkMediaLimits(currentFiles.length, (profile as any)?.plan_tier)) {
          console.log('❌ CreatePost: Media limits exceeded');
          setIsSubmitting(false);
          return;
        }
        
        if (!checkSchedulingLimits(data.publication_date, (profile as any)?.plan_tier)) {
          console.log('❌ CreatePost: Scheduling limits exceeded');
          setIsSubmitting(false);
          return;
        }
      }

      // Create post immediately with "uploading" status
      const postData = {
        workspace_id: currentWorkspace.id,
        title: data.caption?.substring(0, 50) + (data.caption && data.caption.length > 50 ? '...' : '') || 'Rascunho',
        caption: data.caption || '',
        post_type: data.post_type as any,
        platforms: data.platforms as PlatformType[],
        scheduled_for: isDraft ? null : data.publication_date.toISOString(),
        status: (currentFiles.length > 0 && !isDraft ? 'Uploading' : (isDraft ? 'Rascunho' : 'Pendente')) as any,
        additional_comments: data.additional_comments || '',
        media_urls: [], // Will be populated async
        thumbnail_urls: [] // Will be populated async
      };

      console.log('📝 CreatePost: Creating post with data', postData);
      const result = await createPost(postData);
      
      if (result.error) {
        console.error('❌ CreatePost: Post creation failed', result.error);
        toast({
          title: "Error",
          description: `Failed to create post: ${result.error.message || 'Unknown error'}`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      console.log('✅ CreatePost: Post created successfully', result.data);

      const postId = result.data.id;

      // Start async upload process if there are files
      if (currentFiles.length > 0 && profile?.user_id) {
        // Setup upload timeout warning (5 minutes)
        const timeoutWarning = setTimeout(() => {
          console.warn('⚠️ Upload taking longer than expected...');
          setUploadTimeout(true);
        }, 5 * 60 * 1000);

        toast({
          title: "Processing...",
          description: `Starting optimization and upload of ${currentFiles.length} file(s)`,
        });

        // Import required functions - using DIRECT UPLOAD method
        const { uploadToCloudflareR2Direct } = await import('@/lib/cloudflareR2');
        const { optimizeImages } = await import('@/lib/imageOptimization');
        const { generateVideoThumbnail } = await import('@/lib/videoThumbnails');
        const { uploadThumbnailToR2 } = await import('@/lib/cloudflareR2');
        
        try {
          // PHASE 2: Validate available storage before upload
          if (entitlements) {
            const totalFileSize = currentFiles.reduce((sum, f) => sum + f.size, 0);
            const totalSizeMB = totalFileSize / (1024 * 1024);
            const availableStorage = entitlements.storage_total_mb - entitlements.storage_used_mb;
            
            if (totalSizeMB > availableStorage) {
              clearTimeout(timeoutWarning);
              throw new Error(
                `Espaço insuficiente. Necessário: ${totalSizeMB.toFixed(0)}MB, Disponível: ${availableStorage.toFixed(0)}MB`
              );
            }
          }
          
          // PHASE 1: Validate file sizes before upload (max 500MB per file)
          const maxSize = 500 * 1024 * 1024; // 500MB
          const oversizedFiles = currentFiles.filter(f => f.size > maxSize);
          if (oversizedFiles.length > 0) {
            clearTimeout(timeoutWarning);
            throw new Error(`Alguns arquivos são muito grandes. Máximo: 500MB por arquivo.`);
          }

          // Step 1: Optimize all images in parallel (keeping videos as-is)
          console.log('🖼️ Starting parallel image optimization...');
          setOptimizingFiles(true);
          setUploadTotal(currentFiles.length);
          setUploadProgress({});
          setUploadTimeout(false);
          
          const optimizedResults = await optimizeImages(currentFiles);
          
          setOptimizingFiles(false);
          console.log('✅ Image optimization completed');
          
          // PHASE 3: Process uploads in batches for better performance
          const BATCH_SIZE = 3;
          const processingPromises: Promise<void>[] = [];

          for (let i = 0; i < optimizedResults.length; i += BATCH_SIZE) {
            const batch = optimizedResults.slice(i, i + BATCH_SIZE);
            
            const batchPromises = batch.map(async (optimizedResult, batchIndex) => {
              const index = i + batchIndex;
              const file = optimizedResult.file;
              const originalFile = currentFiles[index];
              const fileStartTime = Date.now();
              
              try {
                console.log(`🚀 [FILE-${index + 1}] Iniciando processamento:`, {
                  fileName: file.name,
                  fileSize: file.size,
                  fileType: file.type,
                  isVideo: originalFile.type.startsWith('video/'),
                  index: index + 1,
                  total: currentFiles.length
                });
                
                // PHASE 3: Enhanced progress tracking with status
                setUploadProgress(prev => ({
                  ...prev,
                  [`media-${index}`]: {
                    fileName: file.name,
                    type: 'media',
                    loaded: 0,
                    total: file.size,
                    percentage: 0,
                    status: 'uploading',
                    estimatedTimeRemaining: undefined,
                    uploadSpeed: undefined
                  }
                }));
                
                // Start DIRECT upload with progress tracking
                console.log(`📝 [FILE-${index + 1}] Starting direct upload...`);
                const uploadStartTime = Date.now();
                let lastProgressUpdate = uploadStartTime;
                let lastLoadedBytes = 0;
                
                const uploadResult = await uploadToCloudflareR2Direct(
                  file,
                  currentWorkspace.id,
                  profile.user_id,
                  postId,
                  (progress) => {
                    // PHASE 3: Calculate upload speed and estimated time
                    const now = Date.now();
                    const timeSinceStart = (now - uploadStartTime) / 1000; // seconds
                    const timeSinceLastUpdate = (now - lastProgressUpdate) / 1000;
                    
                    let estimatedTimeRemaining: string | undefined;
                    let uploadSpeed: number | undefined;
                    
                    if (timeSinceLastUpdate > 0.5 && timeSinceStart > 0) { // Update every 500ms
                      const bytesUploaded = progress.loaded - lastLoadedBytes;
                      const speedBytesPerSec = bytesUploaded / timeSinceLastUpdate;
                      uploadSpeed = Math.round(speedBytesPerSec / 1024); // KB/s
                      
                      const remainingBytes = progress.total - progress.loaded;
                      const timeRemainingSeconds = speedBytesPerSec > 0 ? remainingBytes / speedBytesPerSec : 0;
                      
                      const minutes = Math.floor(timeRemainingSeconds / 60);
                      const seconds = Math.floor(timeRemainingSeconds % 60);
                      estimatedTimeRemaining = minutes > 0 
                        ? `${minutes}m ${seconds}s` 
                        : `${seconds}s`;
                      
                      lastProgressUpdate = now;
                      lastLoadedBytes = progress.loaded;
                    }
                    
                    setUploadProgress(prev => {
                      const newProgress = {
                        ...prev,
                        [`media-${index}`]: {
                          fileName: file.name,
                          type: 'media' as const,
                          ...progress,
                          status: 'uploading' as const,
                          estimatedTimeRemaining,
                          uploadSpeed
                        }
                      };
                      
                      // Log only every 10% to reduce console spam
                      const roundedPercentage = Math.floor(progress.percentage);
                      if (roundedPercentage % 10 === 0 || roundedPercentage === 0 || roundedPercentage === 100) {
                        console.log(`📊 [Direct Upload] Progress: ${roundedPercentage}% (${progress.loaded}/${progress.total} bytes)`);
                      }
                      
                      // Sync to database every 10% or on completion
                      if (progress.percentage % 10 === 0 || progress.percentage === 100) {
                        syncProgressToDatabase(postId, newProgress).catch(err => 
                          console.error('Failed to sync progress:', err)
                        );
                      }
                      
                      return newProgress;
                    });
                  }
                );
                
                // PHASE 3: Mark media upload as completed
                setUploadProgress(prev => ({
                  ...prev,
                  [`media-${index}`]: {
                    ...prev[`media-${index}`],
                    percentage: 100,
                    status: 'completed'
                  }
                }));
                
                const uploadDuration = Date.now() - uploadStartTime;
                console.log(`✅ [FILE-${index + 1}] Direct upload completed:`, {
                  duration: `${uploadDuration}ms`,
                  uploadResult
                });
                
                if (uploadResult.error) {
                  setUploadProgress(prev => ({
                    ...prev,
                    [`media-${index}`]: {
                      ...prev[`media-${index}`],
                      status: 'error'
                    }
                  }));
                  throw new Error(uploadResult.error);
                }
                
                // Generate thumbnail for videos in parallel
                let thumbnailPromise: Promise<any> | null = null;
                if (originalFile.type.startsWith('video/')) {
                  console.log(`📝 [FILE-${index + 1}] É um vídeo, iniciando geração de thumbnail...`);
                  
                  // PHASE 3: Initialize thumbnail progress
                  setUploadProgress(prev => ({
                    ...prev,
                    [`thumb-${index}`]: {
                      fileName: `${file.name} (thumbnail)`,
                      type: 'thumbnail',
                      loaded: 0,
                      total: 1,
                      percentage: 0,
                      status: 'uploading'
                    }
                  }));
                  
                  thumbnailPromise = (async () => {
                    const thumbStartTime = Date.now();
                    try {
                      console.log(`🎬 [FILE-${index + 1}] Gerando thumbnail do vídeo...`);
                      const thumbnailResult = await generateVideoThumbnail(originalFile, {
                        quality: 0.9,
                        width: 640,
                        height: 360,
                        timeSeek: 1,
                        format: 'webp'
                      });
                      
                      const thumbGenDuration = Date.now() - thumbStartTime;
                      console.log(`✅ [FILE-${index + 1}] Thumbnail gerado:`, {
                        duration: `${thumbGenDuration}ms`,
                        hasThumbnail: !!thumbnailResult.thumbnailBlob
                      });
                      
                      // PHASE 3: Update thumbnail progress to 50% (generation complete, upload starting)
                      setUploadProgress(prev => ({
                        ...prev,
                        [`thumb-${index}`]: {
                          ...prev[`thumb-${index}`],
                          percentage: 50,
                          status: 'uploading'
                        }
                      }));
                      
                      // Upload thumbnail to R2 (now with direct upload and progress tracking)
                      console.log(`📝 [FILE-${index + 1}] Fazendo upload do thumbnail...`);
                      const thumbUploadStartTime = Date.now();
                      
                      const thumbnailUpload = await uploadThumbnailToR2(
                        thumbnailResult.thumbnailBlob,
                        currentWorkspace.id,
                        profile.user_id,
                        postId,
                        index,
                        // PHASE 3: Track thumbnail upload progress
                        (progress) => {
                          setUploadProgress(prev => ({
                            ...prev,
                            [`thumb-${index}`]: {
                              fileName: `${file.name} (thumbnail)`,
                              type: 'thumbnail',
                              ...progress,
                              percentage: 50 + (progress.percentage / 2), // 50-100%
                              status: 'uploading'
                            }
                          }));
                        }
                      );
                      
                      const thumbUploadDuration = Date.now() - thumbUploadStartTime;
                      console.log(`✅ [FILE-${index + 1}] Thumbnail uploaded:`, {
                        duration: `${thumbUploadDuration}ms`,
                        url: thumbnailUpload.url
                      });
                      
                      if (thumbnailUpload.url) {
                        console.log(`📝 [FILE-${index + 1}] Atualizando post com URL do thumbnail...`);
                        
                        // Update post with thumbnail URL
                        const { data: currentPost } = await supabase
                          .from('posts')
                          .select('thumbnail_urls')
                          .eq('id', postId)
                          .single();
                        
                        if (currentPost) {
                          const thumbnailUrls = [...(currentPost.thumbnail_urls || [])];
                          thumbnailUrls[index] = thumbnailUpload.url;
                          
                          await supabase
                            .from('posts')
                            .update({ thumbnail_urls: thumbnailUrls })
                            .eq('id', postId);
                          
                          console.log(`✅ [FILE-${index + 1}] Thumbnail URL salvo no banco`, thumbnailUpload.url);
                        }
                        
                        // PHASE 3: Mark thumbnail as completed
                        setUploadProgress(prev => ({
                          ...prev,
                          [`thumb-${index}`]: {
                            ...prev[`thumb-${index}`],
                            percentage: 100,
                            status: 'completed'
                          }
                        }));
                      }
                    } catch (thumbError) {
                      const thumbErrorDuration = Date.now() - thumbStartTime;
                      console.error(`❌ [FILE-${index + 1}] FALHA CRÍTICA NA GERAÇÃO DE THUMBNAIL:`, {
                        error: thumbError,
                        errorMessage: thumbError instanceof Error ? thumbError.message : String(thumbError),
                        errorStack: thumbError instanceof Error ? thumbError.stack : undefined,
                        videoFileName: originalFile.name,
                        videoSize: originalFile.size,
                        videoType: originalFile.type,
                        duration: `${thumbErrorDuration}ms`,
                        reason: 'Thumbnail generation or upload failed - post will have NO thumbnail'
                      });
                      
                      // PHASE 3: Mark thumbnail as error
                      setUploadProgress(prev => ({
                        ...prev,
                        [`thumb-${index}`]: {
                          ...prev[`thumb-${index}`],
                          status: 'error'
                        }
                      }));
                      
                      // Log warning instead of showing user-facing toast
                      // The video will be uploaded without thumbnail but user won't be notified
                      console.warn(`⚠️ Video ${originalFile.name} will be uploaded without preview thumbnail`);
                      
                      // Continue even if thumbnail fails (post will have empty thumbnail_urls)
                    }
                  })();
                }
                
                if (thumbnailPromise) {
                  console.log(`📝 [FILE-${index + 1}] Aguardando conclusão do thumbnail...`);
                  await thumbnailPromise;
                  console.log(`✅ [FILE-${index + 1}] Thumbnail promise concluída`);
                }
                
                const fileTotalDuration = Date.now() - fileStartTime;
                console.log(`✅ [FILE-${index + 1}] Processamento completo:`, {
                  fileName: file.name,
                  totalDuration: `${fileTotalDuration}ms`
                });
                
              } catch (uploadError) {
                const fileErrorDuration = Date.now() - fileStartTime;
                console.error(`❌ [FILE-${index + 1}] ERRO NO PROCESSAMENTO:`, {
                  fileName: file.name,
                  error: uploadError,
                  errorMessage: uploadError instanceof Error ? uploadError.message : String(uploadError),
                  errorStack: uploadError instanceof Error ? uploadError.stack : undefined,
                  duration: `${fileErrorDuration}ms`
                });
                
                // PHASE 3: Mark as error
                setUploadProgress(prev => ({
                  ...prev,
                  [`media-${index}`]: {
                    ...prev[`media-${index}`],
                    status: 'error'
                  }
                }));
                throw uploadError; // Re-throw to be caught by Promise.allSettled
              }
            });
            
            processingPromises.push(...batchPromises);
          }

          // Execute all processing in parallel and provide user feedback
          console.log(`📊 [PROCESSING] Aguardando conclusão de ${processingPromises.length} promises...`);
          const allSettledStartTime = Date.now();
          
          // Create persistent toast for background upload tracking
          const { id: uploadToastId, update, dismiss } = toast({
            icon: <Upload className="h-5 w-5 text-blue-500" />,
            title: "Uploading...",
            description: `Processing ${currentFiles.length} file(s) in background`,
            duration: 0, // Persistent - doesn't disappear automatically
          });
          
          // Save toast tracking info globally
          window.__activeUploadToast = {
            id: uploadToastId,
            totalFiles: currentFiles.length,
            completedFiles: 0,
            startTime: Date.now(),
            update,
            dismiss
          };
          
          // Don't wait for uploads to complete - they run in background
          Promise.allSettled(processingPromises).then((results) => {
            const allSettledDuration = Date.now() - allSettledStartTime;
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            const totalFiles = results.length;
            
            console.log(`📊 [PROCESSING-COMPLETE] Todos os uploads processados:`, {
              total: results.length,
              successful,
              failed,
              duration: `${allSettledDuration}ms`,
              results: results.map((r, i) => ({
                index: i + 1,
                status: r.status,
                reason: r.status === 'rejected' ? r.reason : undefined
              }))
            });
            
            // Clear upload_progress and update status when all uploads complete
            supabase
              .from('posts')
              .update({ 
                status: failed > 0 ? 'Erro' : 'Pendente',
                upload_progress: null // Clear progress
              })
              .eq('id', postId)
              .then(({ error }) => {
                if (error) {
                  console.error('Failed to update post status after upload:', error);
                } else {
                  console.log('✅ Upload progress cleared and status updated');
                }
              });
            
            // Update persistent toast with final status
            if (window.__activeUploadToast) {
              const { update } = window.__activeUploadToast;
              
              if (failed === totalFiles) {
                // All uploads failed
                update({
                  id: uploadToastId,
                  icon: <XCircle className="h-5 w-5 text-red-500" />,
                  title: "Upload failed",
                  description: `All ${totalFiles} file(s) failed to upload. Please try again.`,
                  duration: 7000,
                });
                
                // Update post status to Erro
                supabase
                  .from('posts')
                  .update({ 
                    status: 'Erro',
                    additional_comments: t('post.uploadInitializationFailed')
                  })
                  .eq('id', postId)
                  .then(() => console.log('✅ Post status updated to Erro'));
                  
              } else if (failed > 0) {
                // Some uploads failed
                update({
                  id: uploadToastId,
                  icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
                  title: "Upload completed with errors",
                  description: `${successful} of ${totalFiles} file(s) uploaded successfully`,
                  duration: 5000,
                });
              } else {
                // All uploads succeeded
                update({
                  id: uploadToastId,
                  icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
                  title: "Upload complete!",
                  description: `All ${totalFiles} file(s) uploaded successfully`,
                  duration: 5000,
                });
              }
              
              window.__activeUploadToast = null;
            }
            
            clearTimeout(timeoutWarning);
          }).catch(error => {
            console.error('❌ Upload processing error:', error);
            
            // Update toast to show error
            if (window.__activeUploadToast) {
              window.__activeUploadToast.update({
                id: uploadToastId,
                icon: <XCircle className="h-5 w-5 text-red-500" />,
                title: "Upload failed",
                description: "An unexpected error occurred. Please try again.",
                duration: 7000,
              });
              window.__activeUploadToast = null;
            }
            
            clearTimeout(timeoutWarning);
          });
          
        } catch (error) {
          clearTimeout(timeoutWarning);
          console.error('Error during parallel processing:', error);
          toast({
            title: "Processing Error",
            description: error instanceof Error ? error.message : "Failed to process files. Please try again.",
            variant: "destructive",
          });
        } finally {
          clearTimeout(timeoutWarning);
        }
      }

      // Don't show success toast here - persistent upload toast will show progress
      
      // Clean up and close immediately
      Object.values(filePreviewUrls).forEach(url => cleanupPreviewUrl(url));
      Object.values(fileThumbnails).forEach(url => cleanupPreviewUrl(url));
      
      setSelectedFiles([]);
      setFileThumbnails({});
      setFilePreviewUrls({});
      setPreviewKey(0);
      setOptimizingFiles(false);
      setUploadProgress({});
      setUploadTotal(0);
      setUploadTimeout(false);
      setIsSubmitting(false);
      form.reset();
      
      onOpenChange(false);

    } catch (error) {
      console.error('Error in onSubmit:', error);
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  }, [isSubmitting, currentWorkspace, selectedFiles, profile, validatePostLimits, showValidationError, checkMediaLimits, checkSchedulingLimits, createPost, toast, form, onOpenChange, filePreviewUrls, fileThumbnails]);

  // Referência para o input de arquivo
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      return isImage || isVideo;
    });
    
    if (validFiles.length === 0) {
      toast({
        title: "Arquivos inválidos",
        description: "Por favor, selecione apenas arquivos de imagem ou vídeo.",
        variant: "destructive",
      });
      return;
    }
    
    // Media limits removed - users can attach unlimited files per post
    
    // Generate preview URLs and thumbnails
    const newPreviewUrls: Record<string, string> = {};
    const newThumbnails: Record<string, string> = {};
    
    for (const file of validFiles) {
      // Generate preview URL for all files
      const previewUrl = generatePreviewUrl(file);
      newPreviewUrls[file.name] = previewUrl;
      
      // Generate thumbnails for videos
      if (file.type.startsWith('video/')) {
        try {
          const { generateVideoThumbnail } = await import('@/lib/videoThumbnails');
          const result = await generateVideoThumbnail(file);
          const thumbnail = URL.createObjectURL(result.thumbnailBlob);
          newThumbnails[file.name] = thumbnail;
        } catch (error) {
          console.error('Failed to generate thumbnail for video:', file.name, error);
        }
      }
    }
    
    // Update state with batch updates
    setFilePreviewUrls(prev => ({ ...prev, ...newPreviewUrls }));
    setFileThumbnails(prev => ({ ...prev, ...newThumbnails }));
    setSelectedFiles(prev => [...prev, ...validFiles]);
    
    // Force re-render
    setPreviewKey(prev => prev + 1);
    
    // Clear the input to allow selecting the same file again
    event.target.value = '';
  }, [selectedFiles, checkMediaLimits, profile, toast]);

  const removeFile = React.useCallback((index: number) => {
    const fileToRemove = selectedFiles[index];
    
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    
    // Clean up preview URL and thumbnail
    if (fileToRemove) {
      const fileName = fileToRemove.name;
      
      // Clean up preview URL
      if (filePreviewUrls[fileName]) {
        cleanupPreviewUrl(filePreviewUrls[fileName]);
        setFilePreviewUrls(prev => {
          const updated = { ...prev };
          delete updated[fileName];
          return updated;
        });
      }
      
      // Clean up thumbnail
      if (fileThumbnails[fileName]) {
        cleanupPreviewUrl(fileThumbnails[fileName]);
        setFileThumbnails(prev => {
          const updated = { ...prev };
          delete updated[fileName];
          return updated;
        });
      }
    }
    
    // Force re-render
    setPreviewKey(prev => prev + 1);
  }, [selectedFiles, filePreviewUrls, fileThumbnails]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = React.useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      return isImage || isVideo;
    });
    
    // Generate preview URLs and thumbnails
    const newPreviewUrls: Record<string, string> = {};
    const newThumbnails: Record<string, string> = {};
    
    for (const file of validFiles) {
      // Generate preview URL for all files
      const previewUrl = generatePreviewUrl(file);
      newPreviewUrls[file.name] = previewUrl;
      
      // Generate thumbnails for videos
      if (file.type.startsWith('video/')) {
        try {
          const { generateVideoThumbnail } = await import('@/lib/videoThumbnails');
          const result = await generateVideoThumbnail(file);
          const thumbnail = URL.createObjectURL(result.thumbnailBlob);
          newThumbnails[file.name] = thumbnail;
        } catch (error) {
          console.error('Failed to generate thumbnail for video:', file.name, error);
        }
      }
    }
    
    setFilePreviewUrls(prev => ({ ...prev, ...newPreviewUrls }));
    setFileThumbnails(prev => ({ ...prev, ...newThumbnails }));
    setSelectedFiles(prev => [...prev, ...validFiles]);
  }, []);

  const availablePlatforms = currentWorkspace?.platforms || [];

  const getPlatformIcon = (platform: PlatformType) => {
    switch (platform) {
      case 'Instagram':
        return <Instagram className="h-5 w-5 text-pink-500" />;
      case 'Facebook':
        return <Facebook className="h-5 w-5 text-blue-600" />;
      case 'LinkedIn':
        return <Linkedin className="h-5 w-5 text-blue-700" />;
      case 'X':
        return <span className="text-lg">𝕏</span>;
      case 'YT':
        return (
          <svg className="h-5 w-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        );
      case 'Pinterest':
        return (
          <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.372 0 12.017c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.199-2.405.042-3.441.219-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.373 11.99-12.009C24.007 5.372 18.631.001 12.007.001z"/>
          </svg>
        );
      case 'Reddit':
        return (
          <svg className="h-5 w-5 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.238 15.348c.085-.084.085-.221 0-.306-.465-.462-1.194-.687-2.238-.687-.043 0-.087.000-.126.000-.043 0-.087 0-.126 0-1.044 0-1.773.225-2.238.687-.085.085-.085.222 0 .306.085.084.222.084.307 0.379-.378.985-.378 1.238 0.378.378.985.378 1.238 0 .085-.084.222-.084.307 0zM9.777 13.017c0-.564.458-1.022 1.022-1.022.564 0 1.022.458 1.022 1.022 0 .564-.458 1.022-1.022 1.022-.564 0-1.022-.458-1.022-1.022zM13.199 13.017c0-.564.458-1.022 1.022-1.022.564 0 1.022.458 1.022 1.022 0 .564-.458 1.022-1.022 1.022-.564 0-1.022-.458-1.022-1.022zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c.628 0 1.139.511 1.139 1.139 0 .378-.149.719-.391.969.016.129.016.258 0 .386 0 1.996-2.278 3.622-5.1 3.622s-5.1-1.626-5.1-3.622c-.016-.128-.016-.257 0-.386-.242-.25-.391-.591-.391-.969 0-.628.511-1.139 1.139-1.139.35 0 .663.149.884.391 1.308-.96 3.055-1.577 5.006-1.577l1.139-3.622c.043-.129.172-.215.301-.172l2.278.511c.129-.378.463-.645.884-.645.511 0 .928.417.928.928s-.417.928-.928.928-.928-.417-.928-.928l-1.997-.43-.969 3.055c1.95 0 3.698.617 5.006 1.577.221-.242.534-.391.884-.391z"/>
          </svg>
        );
      default:
        return <span className="text-lg">📱</span>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('post.addNewPost')}</DialogTitle>
        </DialogHeader>
        
        {/* Debug: Enhanced R2 Testing - Only for admins */}
        {profile?.role === 'admin' && (
          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Debug: Enhanced R2 Tests</span>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={async () => {
                    toast({
                      title: "Testing R2 Connection",
                      description: "Checking Cloudflare R2 configuration...",
                    });
                    
                    const result = await testR2Connection();
                    
                    if (result.success) {
                      toast({
                        title: "R2 Connection Successful",
                        description: `Connected to bucket: ${result.details?.bucketName}`,
                      });
                    } else {
                      toast({
                        title: "R2 Connection Failed",
                        description: result.error || "Unknown error",
                        variant: "destructive",
                        duration: 5000,
                      });
                    }
                  }}
                >
                  Test R2
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={async () => {
                    if (!currentWorkspace || !profile?.user_id) {
                      toast({
                        title: "Error",
                        description: "Missing workspace or user data",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    // Create a simple test file
                    const testContent = "test-file-content";
                    const testKey = `workspaces/${currentWorkspace.id}/media/test-${Date.now()}.txt`;
                    const testData = btoa(testContent); // base64 encode
                    
                    console.log('🧪 DEBUG: Testing upload with:', {
                      key: testKey,
                      workspace_id: currentWorkspace.id,
                      user_id: profile.user_id,
                      data_length: testData.length
                    });
                    
                    try {
                      const { data, error } = await supabase.functions.invoke('upload-to-r2', {
                        body: {
                          key: testKey,
                          file_data: testData,
                          mime_type: 'text/plain',
                          workspace_id: currentWorkspace.id,
                          user_id: profile.user_id,
                          file_size_bytes: testContent.length
                        }
                      });
                      
                      
                      
                      if (error) {
                        toast({
                          title: "Edge Function Error",
                          description: error.message,
                          variant: "destructive",
                          duration: 5000,
                        });
                      } else {
                        toast({
                          title: "Edge Function Test Successful",
                          description: `Upload successful: ${data?.url}`,
                        });
                      }
                    } catch (err) {
                      console.error('🧪 DEBUG: Edge function test failed:', err);
                      toast({
                        title: "Test Failed",
                        description: err.message,
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Test Upload Function
                </Button>
              </div>
            </div>
            
            <div className="text-xs text-gray-500">
              Selected files: {selectedFiles.length} | Thumbnails: {Object.keys(fileThumbnails).length}
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => onSubmit(data, false))} className="space-y-6">
            {/* 2-column layout: Left (Date + Type) | Right (Platforms) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Publication Date + Post Type */}
              <div className="space-y-4">
                {/* Publication Date */}
                <FormField
                  control={form.control}
                  name="publication_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t('post.publicationDate')} *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              name="publication_date"
                              id="publication_date"
                            >
                              {field.value ? (
                                formatDate(field.value, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language)
                              ) : (
                                <span>dd/mm/yyyy</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              if (date) {
                                field.onChange(date);
                                // Close popover immediately after selection
                                setTimeout(() => {
                                  const popover = document.querySelector('[data-state="open"]') as HTMLElement;
                                  if (popover) popover.click();
                                }, 50);
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Post Type */}
                <FormField
                  control={form.control}
                  name="post_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('post.type')} *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} name="post_type">
                        <FormControl>
                          <SelectTrigger name="post_type" id="post_type">
                            <SelectValue placeholder={t('post.selectType')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(POST_TYPES).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right Column: Publication Platforms */}
              <FormField
                control={form.control}
                name="platforms"
                render={() => (
                  <FormItem>
                    <FormLabel>{t('post.publicationPlatforms')} *</FormLabel>
                    <div className="flex flex-col gap-3 mt-2">
                      {availablePlatforms.map((platform) => (
                        <FormField
                          key={platform}
                          control={form.control}
                          name="platforms"
                          render={({ field }) => {
                            const isChecked = field.value?.includes(platform);
                            return (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={isChecked}
                                    className="rounded-md"
                                    onCheckedChange={(checked) => {
                                      const newValue = checked
                                        ? [...(field.value || []), platform]
                                        : field.value?.filter((value) => value !== platform) || [];
                                      field.onChange(newValue);
                                    }}
                                  />
                                </FormControl>
                                <div className="flex items-center space-x-2">
                                  {getPlatformIcon(platform)}
                                  <FormLabel className="text-sm font-normal cursor-pointer">
                                    {platform}
                                  </FormLabel>
                                </div>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    {availablePlatforms.length === 0 && (
                      <p className="text-sm text-muted-foreground">No platforms configured for this workspace</p>
                    )}
                    {(!form.watch('platforms') || form.watch('platforms').length === 0) && (
                      <p className="text-sm text-red-500">{t('post.selectPlatform')}</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Post Media */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('post.postMedia')} *</label>
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">
                  {t('post.dragAndDrop')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('post.supportsMedia')}
                </p>
                <input
                  id="file-input"
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                  onClick={(e) => {
                    // Reset the input value to allow selecting the same file again
                    e.currentTarget.value = '';
                  }}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  className="mt-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {t('post.selectFiles')}
                </Button>
              </div>
              
                {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{t('post.selectedMedia')} ({selectedFiles.length})</p>
                    {/* PHASE 3: Show total size with badge for large uploads */}
                {selectedFiles.reduce((sum, f) => sum + f.size, 0) > 200 * 1024 * 1024 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-xs flex items-center gap-1 cursor-help">
                          <AlertTriangle className="h-3 w-3" />
                          {t('post.largeUpload', { 
                            size: (selectedFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(0) 
                          })}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{t('post.largeUploadWarning')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('post.dragToReorder')}</p>
                  <DraggableMediaGrid
                    files={selectedFiles}
                    thumbnails={fileThumbnails}
                    onRemove={removeFile}
                    onReorder={(fromIndex, toIndex) => {
                      const newFiles = [...selectedFiles];
                      const [removed] = newFiles.splice(fromIndex, 1);
                      newFiles.splice(toIndex, 0, removed);
                      setSelectedFiles(newFiles);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Caption */}
            <FormField
              control={form.control}
              name="caption"
              render={({ field }) => {
                const isStoriesSelected = form.watch('post_type') === 'Storys';
                return (
                  <FormItem>
                    <FormLabel>{t('post.caption')} {!isStoriesSelected && '*'}</FormLabel>
                     <FormControl>
                       <Textarea
                         placeholder={isStoriesSelected ? t('post.captionOptionalPlaceholder') : t('post.captionPlaceholder')}
                         className="min-h-[100px]"
                         {...field}
                         name="caption"
                         id="caption"
                       />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Additional Comments */}
            <FormField
              control={form.control}
              name="additional_comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('post.additionalComments')}</FormLabel>
                   <FormControl>
                     <Textarea
                       placeholder={t('post.additionalCommentsPlaceholder')}
                       className="min-h-[80px]"
                       {...field}
                       name="additional_comments"
                       id="additional_comments"
                     />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('post.cancel')}
              </Button>
              {canCreateDrafts() && (
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={() => {
                    const formData = form.getValues();
                    onSubmit(formData, true);
                  }}
                  disabled={isSubmitting || optimizingFiles}
                >
                  {optimizingFiles || isSubmitting 
                    ? t('post.processing')
                    : t('post.saveAsDraft')}
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting || optimizingFiles}>
                {optimizingFiles 
                  ? t('post.optimizingImages')
                  : isSubmitting 
                    ? t('post.uploadingFiles', { 
                        current: Object.keys(uploadProgress).length, 
                        total: uploadTotal 
                      })
                    : t('post.addPost')}
              </Button>
            </div>
            
            {/* PHASE 3: Enhanced Upload Progress Display with status and type */}
            {(isSubmitting || optimizingFiles) && Object.keys(uploadProgress).length > 0 && (
              <div className="space-y-3 mt-4 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t('post.uploadProgress')}</p>
                  <p className="text-xs text-muted-foreground">
                    {Object.values(uploadProgress).filter(p => p.status === 'completed').length} / {Object.keys(uploadProgress).length} {t('post.completed')}
                  </p>
                </div>
                
                {Object.entries(uploadProgress).map(([key, progress]) => {
                  const statusIcon = 
                    progress.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                    progress.status === 'error' ? <XCircle className="h-4 w-4 text-red-500" /> :
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
                  
                  const typeLabel = progress.type === 'thumbnail' ? '🖼️' : progress.type === 'media' ? '📁' : '';
                  
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {statusIcon}
                          <span className="truncate" title={progress.fileName}>
                            {typeLabel} {progress.fileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* PHASE 3: Show upload speed and estimated time */}
                          {progress.status === 'uploading' && progress.uploadSpeed && (
                            <span className="text-muted-foreground text-[10px]">
                              {progress.uploadSpeed} KB/s
                            </span>
                          )}
                          {progress.status === 'uploading' && progress.estimatedTimeRemaining && (
                            <span className="text-muted-foreground text-[10px]">
                              ~{progress.estimatedTimeRemaining}
                            </span>
                          )}
                          <span className="text-muted-foreground font-medium">
                            {progress.percentage}%
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={progress.percentage} 
                        className={cn(
                          "h-1.5",
                          progress.status === 'error' && "bg-red-100",
                          progress.status === 'completed' && "bg-green-100"
                        )}
                      />
                    </div>
                  );
                })}
                
                {/* Overall progress */}
                {Object.keys(uploadProgress).length > 1 && (
                  <div className="pt-2 border-t space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>Total Progress</span>
                      <span>
                        {Math.round(
                          Object.values(uploadProgress).reduce((sum, p) => sum + p.percentage, 0) / 
                          Object.keys(uploadProgress).length
                        )}%
                      </span>
                    </div>
                    <Progress 
                      value={
                        Object.values(uploadProgress).reduce((sum, p) => sum + p.percentage, 0) / 
                        Object.keys(uploadProgress).length
                      } 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            )}
            
            {uploadTimeout && (isSubmitting || optimizingFiles) && (
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                O upload está demorando mais que o esperado. Por favor, aguarde ou tente com arquivos menores.
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePostModal;