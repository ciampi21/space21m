import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Upload, X, Instagram, Facebook, Linkedin, Video, ImageIcon, FileVideo, Play, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';
import { POST_TYPES, PlatformType, PLATFORMS, Post } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { uploadToCloudflareR2 } from '@/lib/cloudflareR2';
import { supabase } from '@/integrations/supabase/client';
import { optimizeImages, generatePreviewUrl, cleanupPreviewUrl, canOptimizeImage } from '@/lib/imageOptimization';
import { DraggableMediaGrid, DraggableExistingMediaGrid } from './DraggableMediaGrid';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserEntitlements } from '@/hooks/useUserEntitlements';

const createEditPostSchema = (postType: string, t: any) => z.object({
  publication_date: z.date({
    required_error: t('post.dateRequired'),
  }),
  post_type: z.string({
    required_error: t('post.typeRequired'),
  }),
  platforms: z.array(z.string()).min(1, t('post.platformRequired')),
  caption: postType === 'Storys' 
    ? z.string().optional() 
    : z.string().min(1, t('post.captionRequired')),
  additional_comments: z.string().optional(),
});

type EditPostForm = z.infer<ReturnType<typeof createEditPostSchema>>;

interface EditPostModalProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditPostModal: React.FC<EditPostModalProps> = ({ post, open, onOpenChange }) => {
  const { currentWorkspace, refreshPosts, refreshAllPosts } = useWorkspace();
  const { profile } = useAuth();
  const { entitlements } = useUserEntitlements();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingMedia, setExistingMedia] = useState<string[]>([]);
  const [fileThumbnails, setFileThumbnails] = useState<Record<string, string>>({});
  const [existingVideoThumbnails, setExistingVideoThumbnails] = useState<Record<string, string>>({});
  const [optimizingFiles, setOptimizingFiles] = useState<boolean>(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const editPostSchema = createEditPostSchema(post.post_type, t);
  
  const form = useForm<EditPostForm>({
    resolver: zodResolver(editPostSchema),
    defaultValues: {
      platforms: post.platforms,
      caption: post.caption || '',
      additional_comments: post.additional_comments || '',
      post_type: post.post_type,
      publication_date: post.scheduled_for ? new Date(post.scheduled_for) : new Date(),
    },
  });

  // Function to generate video thumbnail from file
  const generateVideoThumbnailFromFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const fileUrl = URL.createObjectURL(file);
      
      video.onloadeddata = () => {
        video.currentTime = 1; // Get frame at 1 second
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(fileUrl);
        resolve(thumbnailUrl);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(fileUrl);
        reject(new Error('Failed to load video'));
      };
      
      video.src = fileUrl;
    });
  };

  // Function to generate video thumbnail from URL
  const generateVideoThumbnail = (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.currentTime = 1; // Get frame at 1 second
      
      video.onloadeddata = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(thumbnailUrl);
      };
      
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = videoUrl;
    });
  };

  // Function to check if URL is a video
  const isVideoUrl = (url: string): boolean => {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv'];
    const urlLower = url.toLowerCase();
    return videoExtensions.some(ext => urlLower.includes(ext)) || url.includes('video');
  };

  useEffect(() => {
    if (open && post) {
      setExistingMedia(post.media_urls || []);
      form.reset({
        platforms: post.platforms,
        caption: post.caption || '',
        additional_comments: post.additional_comments || '',
        post_type: post.post_type,
        publication_date: post.scheduled_for ? new Date(post.scheduled_for) : new Date(),
      });

      // Generate thumbnails for existing video URLs
      const generateExistingThumbnails = async () => {
        const newThumbnails: Record<string, string> = {};
        
        for (const url of post.media_urls || []) {
          if (isVideoUrl(url) && !existingVideoThumbnails[url]) {
            try {
              const thumbnail = await generateVideoThumbnail(url);
              newThumbnails[url] = thumbnail;
            } catch (error) {
              console.error('Failed to generate thumbnail for existing video:', url, error);
            }
          }
        }
        
        if (Object.keys(newThumbnails).length > 0) {
          setExistingVideoThumbnails(prev => ({ ...prev, ...newThumbnails }));
        }
      };
      
      generateExistingThumbnails();
    }
  }, [open, post, form]);

  const handleSubmit = async (data: EditPostForm, saveAsDraft: boolean = false) => {
    if (!currentWorkspace) return;
    
    try {
      // Validate file sizes and storage before processing
      if (selectedFiles.length > 0) {
        // Validate available storage
        if (entitlements) {
          const totalFileSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
          const totalSizeMB = totalFileSize / (1024 * 1024);
          const availableStorage = entitlements.storage_total_mb - entitlements.storage_used_mb;
          
          if (totalSizeMB > availableStorage) {
            toast({
              title: "Espaço insuficiente",
              description: `Necessário: ${totalSizeMB.toFixed(0)}MB, Disponível: ${availableStorage.toFixed(0)}MB`,
              variant: "destructive",
            });
            return;
          }
        }
        
        // Validate file sizes (max 500MB per file)
        const maxSize = 500 * 1024 * 1024; // 500MB
        const oversizedFiles = selectedFiles.filter(f => f.size > maxSize);
        if (oversizedFiles.length > 0) {
          toast({
            title: "Arquivo muito grande",
            description: `Alguns arquivos são muito grandes. Máximo: 500MB por arquivo.`,
            variant: "destructive",
          });
          return;
        }
      }
      
      let mediaUrls: string[] = [...existingMedia];
      
      // Initialize thumbnail URLs - preserve existing ones for media that wasn't removed
      let thumbnailUrls: string[] = [];
      if (post.thumbnail_urls) {
        // Only keep thumbnails for existing media that wasn't removed
        for (let i = 0; i < existingMedia.length; i++) {
          const originalIndex = post.media_urls?.indexOf(existingMedia[i]) ?? -1;
          if (originalIndex !== -1 && post.thumbnail_urls[originalIndex]) {
            thumbnailUrls.push(post.thumbnail_urls[originalIndex]);
          } else {
            thumbnailUrls.push('');
          }
        }
      }
      
      // Upload new selected files to Cloudflare R2
      if (selectedFiles.length > 0 && profile?.user_id) {
        console.log('Starting optimization and upload of', selectedFiles.length, 'files to R2');
        
        // Optimize images first
        setOptimizingFiles(true);
        const optimizedResults = await optimizeImages(
          selectedFiles,
          (current, total, fileName) => {
          toast({
            title: t('post.optimizingMedia'),
            description: t('post.optimizingFile', { fileName, current, total }),
          });
          }
        );
        setOptimizingFiles(false);
        
        const { generateAndUploadThumbnail } = await import('@/lib/videoThumbnails');
        
        // Upload optimized files
        for (let i = 0; i < optimizedResults.length; i++) {
          const { file, compressionRatio } = optimizedResults[i];
          const originalFile = selectedFiles[i]; // Get original file for filename matching
          console.log(`Uploading optimized file ${i + 1}/${optimizedResults.length}:`, file.name, 'Size:', file.size, 'Compression:', compressionRatio.toFixed(1) + '%');
          
          // Show upload progress
        toast({
          title: t('post.uploadingMedia'),
          description: t('post.uploadingFile', { 
            fileName: file.name, 
            current: i + 1, 
            total: optimizedResults.length 
          }),
        });
          
          const uploadResult = await uploadToCloudflareR2(
            file,
            currentWorkspace.id,
            profile.user_id,
            3 // 3 retries
          );
          
          if (uploadResult.error) {
            console.error('❌ R2 upload error for file', file.name, ':', uploadResult.error);
            toast({
              title: "Upload Error",
              description: `Failed to upload ${file.name}: ${uploadResult.error}`,
              variant: "destructive",
            });
            continue;
          }
          
          console.log('✅ R2 upload successful:', uploadResult.url);
          // Ensure URL has protocol
          const normalizedUrl = uploadResult.url.startsWith('http') ? uploadResult.url : `https://${uploadResult.url}`;
          mediaUrls.push(normalizedUrl);
          
          // Generate and upload thumbnail for videos
          if (file.type.startsWith('video/')) {
            try {
              const thumbnailResult = await generateAndUploadThumbnail(
                originalFile,
                currentWorkspace.id,
                profile.user_id,
                {
                  quality: 0.8,
                  width: 640,
                  height: 360,
                  timeSeek: 1,
                  format: 'webp'
                }
              );
              
              thumbnailUrls.push(thumbnailResult.thumbnailUrl);
              console.log('✅ Video thumbnail uploaded:', thumbnailResult.thumbnailUrl);
            } catch (error) {
              console.error('❌ Error generating thumbnail for video:', originalFile.name, error);
              thumbnailUrls.push('');
            }
          }
          
          // Create media_assets record
          const { error: assetError } = await supabase
            .from('media_assets')
            .insert({
              workspace_id: currentWorkspace.id,
              uploaded_by: profile.user_id,
              r2_key: uploadResult.key,
              size_bytes: file.size,
              mime_type: file.type
            });
            
          if (assetError) {
            console.error('❌ Failed to create media_assets record:', assetError);
          }
        }
        
        // Update post with new thumbnail URLs if any videos were uploaded
        if (thumbnailUrls.some(url => url !== '')) {
          console.log('🎬 Updating post with new thumbnail URLs:', thumbnailUrls);
          // We'll add these to the existing post update below
        }
        
        if (optimizedResults.length > 0) {
          const totalCompression = optimizedResults.reduce((sum, r) => sum + r.compressionRatio, 0) / optimizedResults.length;
          toast({
            title: "Upload Complete",
            description: `Successfully uploaded ${optimizedResults.length} file(s) with ${totalCompression.toFixed(1)}% average compression`,
          });
        }
      }
      
      // Determine status based on original post status and saveAsDraft flag
      let newStatus: Post['status'] = 'Pendente'; // Default to pending
      if (post.status === 'Rascunho' && saveAsDraft) {
        newStatus = 'Rascunho'; // Keep as draft if original was draft and user chose to save as draft
      }
      
      const { error } = await supabase
        .from('posts')
        .update({
          title: data.caption.substring(0, 50) + (data.caption.length > 50 ? '...' : ''),
          caption: data.caption,
          post_type: data.post_type as any,
          platforms: data.platforms as PlatformType[],
          scheduled_for: data.publication_date.toISOString(),
          additional_comments: data.additional_comments || '',
          media_urls: mediaUrls,
          thumbnail_urls: thumbnailUrls,
          status: newStatus
        })
        .eq('id', post.id);

      if (error) {
        console.error('Update error:', error);
        toast({
          title: t('common.error'),
          description: t('common.updateError'),
          variant: "destructive",
        });
      } else {
        const message = saveAsDraft ? 'Rascunho salvo com sucesso' : t('common.postUpdated');
        toast({
          title: t('common.success'),
          description: message,
          duration: 2000,
        });
        onOpenChange(false);
        setSelectedFiles([]);
        setExistingMedia([]);
        setFileThumbnails({});
        setExistingVideoThumbnails({});
        await refreshPosts();
        await refreshAllPosts();
      }
    } catch (error) {
      console.error('Update exception:', error);
      toast({
        title: t('common.error'),
        description: t('common.updateError'),
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file sizes (max 500MB per file)
    const maxSize = 500 * 1024 * 1024; // 500MB
    const oversizedFiles = files.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
        toast({
          title: t('post.fileTooLarge'),
          description: t('post.fileTooLargeDescription'),
          variant: "destructive",
        });
      return;
    }
    
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      return isImage || isVideo;
    });
    
    // Generate thumbnails for videos
    const newThumbnails: Record<string, string> = {};
    for (const file of validFiles) {
      if (file.type.startsWith('video/')) {
        try {
          const thumbnail = await generateVideoThumbnailFromFile(file);
          newThumbnails[file.name] = thumbnail;
        } catch (error) {
          console.error('Failed to generate thumbnail for video:', file.name, error);
        }
      }
    }
    
    setFileThumbnails(prev => ({ ...prev, ...newThumbnails }));
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingMedia = (index: number) => {
    setExistingMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    // Validate file sizes (max 500MB per file)
    const maxSize = 500 * 1024 * 1024; // 500MB
    const oversizedFiles = files.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      toast({
        title: t('post.fileTooLarge'),
        description: t('post.fileTooLargeDescription'),
        variant: "destructive",
      });
      return;
    }
    
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      return isImage || isVideo;
    });
    
    // Generate thumbnails for videos
    const newThumbnails: Record<string, string> = {};
    for (const file of validFiles) {
      if (file.type.startsWith('video/')) {
        try {
          const thumbnail = await generateVideoThumbnailFromFile(file);
          newThumbnails[file.name] = thumbnail;
        } catch (error) {
          console.error('Failed to generate thumbnail for video:', file.name, error);
        }
      }
    }
    
    setFileThumbnails(prev => ({ ...prev, ...newThumbnails }));
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

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
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>{t('post.edit')}</DialogTitle>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => handleSubmit(data, false))} className="space-y-6">
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
                      <FormLabel>{t('common.publicationDate')}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy")
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
                              field.onChange(date);
                              setTimeout(() => {
                                const trigger = document.querySelector('[data-state="open"]') as HTMLElement;
                                if (trigger) trigger.click();
                              }, 50);
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
                      <FormLabel>{t('common.postType')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('common.selectType')} />
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
                    <FormLabel>{t('common.publicationPlatforms')}</FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Existing Media */}
            {existingMedia.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('common.currentMedia')}</label>
                <p className="text-xs text-muted-foreground">{t('post.dragToReorder')}</p>
                <DraggableExistingMediaGrid
                  mediaUrls={existingMedia}
                  thumbnails={existingVideoThumbnails}
                  savedThumbnails={post.thumbnail_urls || []}
                  onRemove={removeExistingMedia}
                  onReorder={(fromIndex, toIndex) => {
                    const newUrls = [...existingMedia];
                    const [removed] = newUrls.splice(fromIndex, 1);
                    newUrls.splice(toIndex, 0, removed);
                    setExistingMedia(newUrls);
                  }}
                />
              </div>
            )}

            {/* New Media Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('post.postMedia')}</label>
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById('edit-file-input')?.click()}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">
                  {t('post.dragAndDrop')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('post.supportsMedia')}
                </p>
                <input
                  id="edit-file-input"
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button type="button" variant="outline" className="mt-4">
                  {t('post.selectFiles')}
                </Button>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{t('post.selectedMedia')} ({selectedFiles.length})</p>
                    {/* Show badge for large uploads (>200MB total) */}
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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('post.caption')} *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('post.captionPlaceholder')}
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
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
                {t('common.cancel')}
              </Button>
              {post.status === 'Rascunho' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.handleSubmit((data) => handleSubmit(data, true))()}
                >
                  {t('common.save')}
                </Button>
              )}
              <Button type="submit">
                {post.status === 'Rascunho' ? t('common.editAndResubmit') : t('common.editAndResubmit')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditPostModal;
