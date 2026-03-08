import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Download, Copy, CheckCircle, XCircle, Edit, Calendar, Clock, Trash2, X, ChevronLeft, ChevronRight, MessageSquare, Play, Loader2 } from 'lucide-react';
import EditPostModal from './EditPostModal';
import { Post, POST_TYPES, PLATFORMS, POST_STATUSES } from '@/types';
import { format } from 'date-fns';
import { useStorageCalculation } from '@/hooks/useStorageCalculation';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatDateTime } from '@/lib/dateUtils';
import { normalizeMediaUrl, extractR2KeyFromUrl } from '@/lib/utils';
import { getThumbnailForMedia, getThumbnailSync } from '@/utils/thumbnailUtils';
import { isVideoUrl } from '@/lib/videoThumbnails';

interface PostComment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
}

interface PostDetailsModalProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allPosts?: Post[];
}

const PostDetailsModal: React.FC<PostDetailsModalProps> = ({ 
  post, 
  open, 
  onOpenChange,
  allPosts 
}) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { refreshPosts, refreshAllPosts } = useWorkspace();
  const { profile } = useAuth();
  const { calculateAndUpdateStorageUsage } = useStorageCalculation();
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [postComments, setPostComments] = useState<PostComment[]>([]);
  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string>>({});
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const currentPost = allPosts ? allPosts[selectedPostIndex] : post;
  const isMultiplePosts = allPosts && allPosts.length > 1;

  // Function to get thumbnail for media item (integrating videoThumbnails state)
  const getMediaThumbnail = (mediaUrl: string, mediaIndex: number): string => {
    const normalizedUrl = normalizeMediaUrl(mediaUrl);
    
    // First check if we have a dynamically loaded thumbnail in state
    if (videoThumbnails[normalizedUrl]) {
      return videoThumbnails[normalizedUrl];
    }
    
    // Fallback to sync utility (saved thumbnails or fallback)
    const syncResult = getThumbnailSync(mediaUrl, currentPost?.thumbnail_urls, mediaIndex);
    return syncResult.thumbnailUrl;
  };

  // Generate better thumbnails asynchronously
  useEffect(() => {
    if (currentPost?.media_urls) {
      const loadBetterThumbnails = async () => {
        const newThumbnails: Record<string, string> = {};
        
        for (let i = 0; i < currentPost.media_urls.length; i++) {
          const url = currentPost.media_urls[i];
          const normalizedUrl = normalizeMediaUrl(url);
          
          if (isVideoUrl(normalizedUrl) && !videoThumbnails[normalizedUrl]) {
            try {
              const result = await getThumbnailForMedia(normalizedUrl, currentPost.thumbnail_urls, i);
              newThumbnails[normalizedUrl] = result.thumbnailUrl;
            } catch (error) {
              console.error('Failed to generate thumbnail for video:', url, error);
            }
          }
        }
        
        if (Object.keys(newThumbnails).length > 0) {
          setVideoThumbnails(prev => ({ ...prev, ...newThumbnails }));
        }
      };
      
      loadBetterThumbnails();
    }
  }, [currentPost?.media_urls]);

  // Clear videoThumbnails cache when post changes to prevent thumbnail leak
  useEffect(() => {
    setVideoThumbnails({});
  }, [currentPost?.id]);

  const fetchPostComments = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', currentPost.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        return;
      }

      setPostComments(data || []);
    } catch (error) {
      console.error('Exception fetching comments:', error);
    }
  };

  useEffect(() => {
    if (open && currentPost.id) {
      fetchPostComments();
    }
  }, [open, currentPost.id]);

  // Reset currentMediaIndex when post changes
  useEffect(() => {
    setCurrentMediaIndex(0);
  }, [currentPost?.id]);

  // Keyboard navigation for media
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open || !currentPost?.media_urls || currentPost.media_urls.length <= 1) return;
      
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (selectedMediaIndex !== null) {
          // Full-screen mode
          if (selectedMediaIndex > 0) {
            setSelectedMediaIndex(selectedMediaIndex - 1);
          }
        } else {
          // Main modal mode
          if (currentMediaIndex > 0) {
            setCurrentMediaIndex(currentMediaIndex - 1);
          }
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (selectedMediaIndex !== null) {
          // Full-screen mode
          if (selectedMediaIndex < currentPost.media_urls.length - 1) {
            setSelectedMediaIndex(selectedMediaIndex + 1);
          }
        } else {
          // Main modal mode
          if (currentMediaIndex < currentPost.media_urls.length - 1) {
            setCurrentMediaIndex(currentMediaIndex + 1);
          }
        }
      }
    };

    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, currentPost?.media_urls, selectedMediaIndex, currentMediaIndex]);

  const handleCopyCaption = async () => {
    if (currentPost.caption) {
      await navigator.clipboard.writeText(currentPost.caption);
      toast({
        title: t('post.captionCopied'),
        duration: 2000,
      });
    }
  };

  const handleDownloadMedia = async () => {
    if (!currentPost.media_urls || currentPost.media_urls.length === 0) {
      toast({
        title: t('post.noMediaFound'),
        description: t('post.noMediaDescription'),
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated');
      }

      // Download each media file via edge function
      for (let i = 0; i < currentPost.media_urls.length; i++) {
        const url = normalizeMediaUrl(currentPost.media_urls[i]);
        
        // Extract filename from URL
        const urlPath = new URL(url).pathname;
        const filename = urlPath.split('/').pop() || `media-${currentPost.id}-${i + 1}`;
        
        // Call edge function to download media
        const downloadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-media?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
        
        // Create download link that calls our edge function
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        
        // Add authorization header via link click
        fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }).then(response => response.blob())
          .then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(blobUrl);
          });
      }

      toast({
        title: t('post.downloadCompleted'),
        description: `${currentPost.media_urls.length} arquivo(s) sendo baixado(s)`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: t('post.downloadError'),
        description: t('post.downloadErrorDescription'),
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleStatusUpdate = async (newStatus: Post['status'], reason?: string) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Prepare update data
      const updateData: any = { status: newStatus };
      
      // If rejecting with a reason, add it to the update
      if (newStatus === 'Reprovado' && reason) {
        updateData.rejection_reason = reason;
      }
      
      const { error } = await supabase
        .from('posts')
        .update(updateData)
        .eq('id', currentPost.id);

      if (error) {
        console.error('Status update error:', error);
        toast({
          title: t('common.error'),
          description: t('common.statusUpdateError'),
          variant: "destructive"
        });
        return;
      }

      // For Schedule and Post actions, also copy caption and download media
      if (newStatus === 'Programado' || newStatus === 'Postado') {
        await handleCopyCaption();
        await handleDownloadMedia();
      }

      toast({
        title: t('common.statusUpdated'),
        description: newStatus === 'Postado' ? t('common.postPosted') : `${t('common.statusUpdated')}: ${t(`status.${newStatus}`)}`,
        duration: 2000,
      });

      // Refresh posts without page reload
      await refreshPosts();
      await refreshAllPosts();
    } catch (error) {
      console.error('Status update exception:', error);
      toast({
        title: t('common.error'),
        description: t('common.statusUpdateError'),
        variant: "destructive"
      });
    }
  };

  const handleRejectPost = async () => {
    if (!rejectReason.trim()) {
      toast({
        title: t('post.reasonRequired'),
        description: t('post.reasonRequiredDescription'),
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // First, update the post status
      const { error: statusError } = await supabase
        .from('posts')
        .update({ status: 'Reprovado' })
        .eq('id', currentPost.id);

      if (statusError) {
        console.error('Status update error:', statusError);
        toast({
          title: t('common.error'),
          description: t('post.rejectPost'),
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      // Then, save the rejection comment
      const { error: commentError } = await supabase
        .from('post_comments')
        .insert({
          post_id: currentPost.id,
          user_id: profile?.id,
          comment: `[REPROVAÇÃO] ${rejectReason.trim()}`
        });

      if (commentError) {
        console.error('Comment save error:', commentError);
        // Don't fail the whole operation if comment fails
      }

      toast({
        title: t('post.postRejected'),
        description: t('post.postRejectedDescription'),
        duration: 3000,
      });

      // Close dialog and refresh
      setShowRejectModal(false);
      setRejectReason('');
      
      // Refresh posts
      await refreshPosts();
      await refreshAllPosts();
    } catch (error) {
      console.error('Rejection error:', error);
      toast({
        title: t('common.error'),
        description: t('post.rejectPost'),
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleDeletePost = async () => {
    if (isDeleting) return; // Prevent multiple executions
    
    const validWords = ['delete', 'apagar', 'eliminar'];
    const inputText = deleteConfirmText.toLowerCase().trim();
    
    if (!validWords.includes(inputText)) {
      toast({
        title: t('common.error'),
        description: t('common.deleteConfirmText'),
        variant: "destructive"
      });
      return;
    }

    setIsDeleting(true);
    
    toast({
      title: t('post.deletingPost'),
      description: t('post.deletingPostDescription'),
      duration: 3000,
    });

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      console.log('🗑️ Deleting post:', currentPost.id);
      
      // Use the safe delete edge function for better error handling
      const { data, error } = await supabase.functions.invoke('delete-post-safe', {
        body: { 
          postId: currentPost.id,
          workspaceId: currentPost.workspace_id
        }
      });

      if (error) {
        console.error('Delete post safe error:', error);
        
        // Provide more specific error messages
        let errorMessage = t('common.deleteError');
        if (error.message?.includes('not found')) {
          errorMessage = 'Post não encontrado ou você não tem permissão para deletá-lo.';
        } else if (error.message?.includes('permission')) {
          errorMessage = 'Você não tem permissão para deletar este post.';
        } else if (error.message?.includes('constraint')) {
          errorMessage = 'Não é possível deletar este post pois ele possui dependências.';
        }
        
        toast({
          title: t('common.error'),
          description: errorMessage,
          variant: "destructive"
        });
        return;
      }

      if (!data?.success) {
        console.error('Delete post safe failed:', data);
        toast({
          title: t('common.error'),
          description: data?.error || t('common.deleteError'),
          variant: "destructive"
        });
        return;
      }

      console.log('🗑️ Post deleted successfully via edge function');

      toast({
        title: t('post.postDeleted'),
        description: t('post.postDeletedDescription')
      });

      onOpenChange(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      
      // Refresh posts without page reload
      await refreshPosts();
      await refreshAllPosts();
      
    } catch (error) {
      console.error('Delete exception:', error);
      
      // Fallback to direct deletion if edge function fails
      console.log('🔄 Trying fallback direct deletion...');
      
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        
        const { error: directError } = await supabase
          .from('posts')
          .delete()
          .eq('id', currentPost.id);

        if (directError) {
          console.error('Fallback delete error:', directError);
          
          let errorMessage = 'Erro ao deletar post';
          if (directError.code === 'PGRST301') {
            errorMessage = 'Post não encontrado ou você não tem permissão para deletá-lo.';
          } else if (directError.message?.toLowerCase().includes('permission')) {
            errorMessage = 'Você não tem permissão para deletar este post.';
          } else if (directError.message?.toLowerCase().includes('violates')) {
            errorMessage = 'Não é possível deletar este post pois ele possui dependências.';
          }
          
          toast({
            title: t('common.error'),
            description: errorMessage,
            variant: "destructive"
          });
          return;
        }

        // Try to cleanup media and recalculate storage
        try {
          await calculateAndUpdateStorageUsage();
        } catch (cleanupError) {
          console.warn('Storage cleanup warning:', cleanupError);
        }

        toast({
          title: t('post.postDeleted'),
          description: t('post.postDeletedDescription')
        });

        onOpenChange(false);
        setShowDeleteConfirm(false);
        setDeleteConfirmText('');
        
        await refreshPosts();
        await refreshAllPosts();
        
      } catch (fallbackError) {
        console.error('Fallback delete failed:', fallbackError);
        toast({
          title: t('common.error'),
          description: 'Erro interno. Tente novamente ou contate o suporte.',
          variant: "destructive"
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Pendente': 'bg-yellow-100 text-yellow-800',
      'Revisado': 'bg-blue-100 text-blue-800',
      'Reprovado': 'bg-red-100 text-red-800',
      'Aprovado': 'bg-green-100 text-green-800',
      'Programado': 'bg-purple-100 text-purple-800',
      'Postado': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusHeaderColor = (status: string) => {
    const colors: Record<string, string> = {
      'Pendente': 'bg-yellow-500',
      'Revisado': 'bg-blue-500',
      'Reprovado': 'bg-red-500',
      'Aprovado': 'bg-green-500',
      'Programado': 'bg-purple-500',
      'Postado': 'bg-gray-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const handlePreviousMedia = () => {
    if (selectedMediaIndex !== null && currentPost.media_urls && selectedMediaIndex > 0) {
      setSelectedMediaIndex(selectedMediaIndex - 1);
    }
  };

  const handleNextMedia = () => {
    if (selectedMediaIndex !== null && currentPost.media_urls && selectedMediaIndex < currentPost.media_urls.length - 1) {
      setSelectedMediaIndex(selectedMediaIndex + 1);
    }
  };

  const handleDownloadCurrentMedia = async () => {
    if (selectedMediaIndex !== null && currentPost.media_urls && currentPost.media_urls[selectedMediaIndex]) {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('User not authenticated');
        }

        const url = normalizeMediaUrl(currentPost.media_urls[selectedMediaIndex]);
        
        // Extract filename from URL
        const urlPath = new URL(url).pathname;
        const filename = urlPath.split('/').pop() || `media-${currentPost.id}-${selectedMediaIndex + 1}`;
        
        // Call edge function to download media
        const downloadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-media?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
        
        // Download via edge function
        fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }).then(response => response.blob())
          .then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(blobUrl);
          });

        toast({
          title: "Download iniciado",
          description: "Arquivo sendo baixado",
          duration: 3000,
        });
      } catch (error) {
        console.error('Download error:', error);
        toast({
          title: "Erro no download",
          description: "Não foi possível baixar o arquivo",
          variant: "destructive",
          duration: 3000,
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0 flex flex-col">
        {/* Header with title and status - Fixed */}
        <div className={`flex items-center justify-between py-4 px-6 text-white flex-shrink-0 ${getStatusHeaderColor(currentPost.status)}`}>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{t('post.details')}</h2>
            <Separator orientation="vertical" className="h-6 bg-white/30" />
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 flex items-center gap-2">
              {POST_STATUSES[currentPost.status]?.label || currentPost.status}
              {currentPost.status === 'Uploading' && currentPost.upload_progress && (
                <span className="font-bold">
                  ({Math.round((currentPost.upload_progress.completed / currentPost.upload_progress.total) * 100)}%)
                </span>
              )}
            </Badge>
          </div>
        </div>

        {/* Navigation for multiple posts - Fixed */}
        {isMultiplePosts && (
          <div className="flex space-x-2 px-6 py-3 flex-shrink-0 border-b">
            {allPosts?.map((_, index) => (
              <Button
                key={index}
                variant={selectedPostIndex === index ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPostIndex(index)}
              >
                {index + 1}
              </Button>
            ))}
          </div>
        )}

        {/* Scrollable content area */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left side - Media Section - No scroll */}
          <div className="flex-1 p-4">
            {/* Main Image */}
            {currentPost.media_urls && currentPost.media_urls.length > 0 ? (
              <div className="space-y-4">
                 {/* Principal image with navigation */}
                 <div className="relative aspect-square bg-muted rounded-lg overflow-hidden max-w-md mx-auto">
                     {isVideoUrl(normalizeMediaUrl(currentPost.media_urls[currentMediaIndex])) ? (
                      <div className="relative w-full h-full">
                        <img
                          src={getMediaThumbnail(currentPost.media_urls[currentMediaIndex], currentMediaIndex)}
                          alt={`${currentPost.title} - Video ${currentMediaIndex + 1}`}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setSelectedMediaIndex(currentMediaIndex)}
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/50 rounded-full p-4">
                            <Play className="h-8 w-8 text-white fill-white" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={normalizeMediaUrl(currentPost.media_urls[currentMediaIndex])}
                        alt={`${currentPost.title} - Media ${currentMediaIndex + 1}`}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setSelectedMediaIndex(currentMediaIndex)}
                      />
                    )}
                  
                  {/* Navigation controls for multiple media */}
                  {currentPost.media_urls.length > 1 && (
                    <>
                      {/* Previous button */}
                      {currentMediaIndex > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentMediaIndex(currentMediaIndex - 1)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {/* Next button */}
                      {currentMediaIndex < currentPost.media_urls.length - 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentMediaIndex(currentMediaIndex + 1)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {/* Media counter */}
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                        {currentMediaIndex + 1} {t('common.of')} {currentPost.media_urls.length}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Thumbnail images */}
                {currentPost.media_urls.length > 1 && (
                  <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                     {currentPost.media_urls.slice(0, 11).map((mediaUrl, index) => (
                       <div 
                         key={index} 
                         className={`relative w-16 h-16 bg-muted rounded-lg overflow-hidden cursor-pointer border-2 ${
                           currentMediaIndex === index ? 'border-primary' : 'border-transparent'
                         }`}
                         onClick={() => setCurrentMediaIndex(index)}
                       >
                           {isVideoUrl(normalizeMediaUrl(mediaUrl)) ? (
                            <div className="relative w-full h-full">
                              <img
                                src={getMediaThumbnail(mediaUrl, index)}
                                alt={`${currentPost.title} - Video Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-black/50 rounded-full p-1">
                                  <Play className="h-3 w-3 text-white fill-white" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={normalizeMediaUrl(mediaUrl)}
                              alt={`${currentPost.title} - Thumbnail ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          )}
                       </div>
                     ))}
                    
                    {/* Show "+X" if there are more than 12 images */}
                    {currentPost.media_urls.length > 12 && (
                      <div 
                        className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center cursor-pointer text-sm font-semibold border-2 border-transparent hover:border-muted-foreground"
                        onClick={() => setCurrentMediaIndex(11)}
                      >
                        +{currentPost.media_urls.length - 11}
                      </div>
                    )}
                    
                    {/* Show 12th thumbnail if exactly 12 images */}
                    {currentPost.media_urls.length === 12 && (
                      <div 
                        key={11} 
                        className={`relative w-16 h-16 bg-muted rounded-lg overflow-hidden cursor-pointer border-2 ${
                          currentMediaIndex === 11 ? 'border-primary' : 'border-transparent'
                        }`}
                         onClick={() => setCurrentMediaIndex(11)}
                       >
                           {(async () => {
                             const { isVideoUrl } = await import('@/lib/videoThumbnails');
                             return isVideoUrl(normalizeMediaUrl(currentPost.media_urls[11]));
                           })() ? (
                            <div className="relative w-full h-full">
                              <img
                                src={videoThumbnails[normalizeMediaUrl(currentPost.media_urls[11])] || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik04IDV2MTRsOS03LTlMN3oiIGZpbGw9IiM2Mzc1OGYiLz4KPC9zdmc+'}
                                alt={`${currentPost.title} - Video Thumbnail 12`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-black/50 rounded-full p-1">
                                  <Play className="h-3 w-3 text-white fill-white" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={normalizeMediaUrl(currentPost.media_urls[11])}
                              alt={`${currentPost.title} - Thumbnail 12`}
                              className="w-full h-full object-cover"
                            />
                          )}
                       </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center max-w-md mx-auto">
                <div className="text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2" />
                  <p>{t('post.noMedia')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right side - Details Section */}
          <div className="w-full lg:w-[480px] bg-gray-50 p-4 overflow-y-auto border-l">
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="space-y-3">
                <div>
                  <span className="text-muted-foreground text-sm">{t('post.type')}:</span>
                  <p className="font-medium">{POST_TYPES[currentPost.post_type]?.label}</p>
                </div>
                
                {currentPost.scheduled_for && (
                  <div>
                    <span className="text-muted-foreground text-sm">{t('post.scheduledDate')}:</span>
                    <p className="font-medium">
                      {formatDate(currentPost.scheduled_for, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language)}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-muted-foreground text-sm">{t('post.platforms')}:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {currentPost.platforms.map((platform) => (
                      <div key={platform} className="flex items-center gap-1 bg-white px-2 py-1 rounded-full text-xs border">
                        {platform === 'Instagram' && (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        )}
                        {platform === 'Facebook' && (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        )}
                        {platform === 'LinkedIn' && (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        )}
                        <span>{PLATFORMS[platform]?.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upload Progress Section */}
              {currentPost.status === 'Uploading' && currentPost.upload_progress && (
                <>
                  <Separator />
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-900">
                        {t('post.uploadingFiles')}
                      </span>
                      <span className="text-sm font-bold text-blue-900">
                        {currentPost.upload_progress.completed} / {currentPost.upload_progress.total}
                      </span>
                    </div>
                    
                    {/* Overall Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-blue-700">
                        <span>Overall Progress</span>
                        <span className="font-bold">
                          {Math.round((currentPost.upload_progress.completed / currentPost.upload_progress.total) * 100)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.round((currentPost.upload_progress.completed / currentPost.upload_progress.total) * 100)} 
                        className="h-2 bg-blue-100"
                      />
                    </div>
                    
                    {/* Individual Files */}
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {currentPost.upload_progress.files
                        .filter((f: any) => f.status !== 'completed')
                        .map((file: any, idx: number) => (
                          <div key={idx} className="space-y-1 p-2 bg-white rounded border border-blue-100">
                            <div className="flex justify-between text-xs">
                              <span className="truncate max-w-[250px] font-medium" title={file.name}>
                                {file.name}
                              </span>
                              <span className="font-bold text-blue-600">
                                {file.percentage}%
                              </span>
                            </div>
                            <Progress value={file.percentage} className="h-1" />
                            {file.uploadSpeed && (
                              <div className="text-[10px] text-blue-600">
                                {file.uploadSpeed} KB/s
                                {file.estimatedTimeRemaining && ` • ${file.estimatedTimeRemaining}`}
                              </div>
                            )}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Caption */}
              {currentPost.caption && (
                <div>
                  <span className="text-muted-foreground text-sm">{t('post.caption')}:</span>
                  <p className="mt-2 text-sm leading-relaxed bg-white p-3 rounded-lg whitespace-pre-wrap">{currentPost.caption}</p>
                </div>
              )}

              {/* Additional Comments */}
              {currentPost.additional_comments && (
                <div>
                  <span className="text-muted-foreground text-sm">{t('post.additionalComments')}:</span>
                  <p className="mt-2 text-sm leading-relaxed bg-white p-3 rounded-lg whitespace-pre-wrap">{currentPost.additional_comments}</p>
                </div>
              )}

              {/* Post Comments */}
              {postComments.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground text-sm">{t('post.comments')}:</span>
                  </div>
                  <div className="space-y-3">
                    {postComments.map((comment) => (
                      <div key={comment.id} className="bg-white p-3 rounded-lg border-l-4 border-l-red-500">
                        <p className="text-sm leading-relaxed">
                          {comment.comment.replace('[REPROVAÇÃO] ', '')}
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {formatDateTime(comment.created_at, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Timestamps */}
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('common.createdAt')}:</span>
                  <p className="font-medium">{formatDateTime(currentPost.created_at, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('common.statusUpdated')}:</span>
                  <p className="font-medium">{POST_STATUSES[currentPost.status]?.label || currentPost.status}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('common.statusUpdated')}:</span>
                  <p className="font-medium">{formatDateTime(currentPost.updated_at, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="border-t bg-white px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Left side - Media actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadMedia}
                disabled={!currentPost.media_urls?.length}
                className="text-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('common.downloadMedia')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCaption}
                disabled={!currentPost.caption}
                className="text-sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                {t('common.copyCaption')}
              </Button>
            </div>

            {/* Right side - Status actions */}
            <div className="flex gap-2">
              {currentPost.status === 'Pendente' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectModal(true)}
                    className="text-red-600 hover:text-red-700 border-red-600 hover:border-red-700"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {t('common.reject')}
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate('Aprovado')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {t('common.approve')}
                  </Button>
                </>
              )}
              
              {currentPost.status === 'Rascunho' && (
                <Button
                  variant="outline"
                  onClick={() => setEditModalOpen(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {t('common.edit')}
                </Button>
              )}
              
              {currentPost.status === 'Reprovado' && (
                <Button
                  variant="outline"
                  onClick={() => setEditModalOpen(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {t('common.editAndResubmit')}
                </Button>
              )}
              
              {currentPost.status === 'Erro' && (
                <Button
                  variant="outline"
                  onClick={() => setEditModalOpen(true)}
                  className="border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {t('common.editAndRetry')}
                </Button>
              )}
              
              {currentPost.status === 'Aprovado' && (
                <>
                  <Button
                    variant="outline"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => handleStatusUpdate('Programado')}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {t('common.schedulePost')}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => handleStatusUpdate('Postado')}
                  >
                    {t('common.postNow')}
                  </Button>
                </>
              )}

              {/* Delete functionality */}
              {currentPost.status !== 'Pendente' && !showDeleteConfirm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-600 hover:text-red-700"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              {showDeleteConfirm && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t('common.deleteConfirmText')}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="h-8 text-xs w-48"
                    disabled={isDeleting}
                  />
                  <Button
                    size="sm"
                    onClick={handleDeletePost}
                    className="bg-red-600 hover:bg-red-700 h-8"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    className="h-8"
                    disabled={isDeleting}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Full-screen media modal */}
      {selectedMediaIndex !== null && currentPost.media_urls && (
        <Dialog open={true} onOpenChange={() => setSelectedMediaIndex(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-transparent border-none">
            {/* Clickable overlay with black transparent filter */}
            <div 
              className="fixed inset-0 bg-black/70 flex items-center justify-center cursor-pointer"
              onClick={() => setSelectedMediaIndex(null)}
            >
              {/* Content container - prevent click propagation */}
              <div 
                className="relative flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMediaIndex(null)}
                  className="absolute -top-12 right-0 z-10 text-white hover:bg-white/10"
                >
                  <X className="h-6 w-6" />
                </Button>

                {/* Download button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadCurrentMedia}
                  className="absolute -top-12 right-12 z-10 text-white hover:bg-white/10"
                >
                  <Download className="h-6 w-6" />
                </Button>

                {/* Previous button */}
                {currentPost.media_urls.length > 1 && selectedMediaIndex > 0 && (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={handlePreviousMedia}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/10"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                )}

                {/* Next button */}
                {currentPost.media_urls.length > 1 && selectedMediaIndex < currentPost.media_urls.length - 1 && (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={handleNextMedia}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/10"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                )}

                {/* Page counter */}
                {currentPost.media_urls.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {selectedMediaIndex + 1} de {currentPost.media_urls.length}
                  </div>
                )}

                 {/* Main media - image or video */}
                  {isVideoUrl(currentPost.media_urls[selectedMediaIndex]) ? (
                   <video
                     src={normalizeMediaUrl(currentPost.media_urls[selectedMediaIndex])}
                     controls
                     autoPlay
                     className="max-w-[90vw] max-h-[80vh] object-contain"
                   />
                 ) : (
                   <img
                     src={normalizeMediaUrl(currentPost.media_urls[selectedMediaIndex])}
                     alt={`${currentPost.title} - Media ${selectedMediaIndex + 1}`}
                     className="max-w-[90vw] max-h-[80vh] object-contain"
                   />
                 )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject Reason Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('common.rejectReason')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('common.rejectReasonDescription')}
            </p>
            <Textarea
              placeholder={t('common.rejectReasonPlaceholder')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false);
                setRejectReason('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectPost}
              disabled={!rejectReason.trim()}
            >
              {t('post.rejectPost')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Post Modal */}
      <EditPostModal
        post={currentPost}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
      />
    </Dialog>
  );
};

export default PostDetailsModal;