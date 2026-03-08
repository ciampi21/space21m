import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Calendar, 
  MessageSquare, 
  Eye, 
  Edit, 
  Check, 
  X,
  Clock,
  Send,
  Play,
  ImageIcon,
  Loader2
} from 'lucide-react';
import { Post, POST_STATUSES, POST_TYPES, PLATFORMS } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PostDetailsModal from './PostDetailsModal';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/dateUtils';
import { normalizeMediaUrl } from '@/lib/utils';
import { useWorkspacePermissions } from '@/hooks/useWorkspacePermissions';
import { getThumbnailForMedia, getThumbnailSync } from '@/utils/thumbnailUtils';
import { isVideoUrl, getVideoThumbnailFallback } from '@/lib/videoThumbnails';
import { MediaThumbnail } from '@/components/ui/media-thumbnail';

interface PostCardProps {
  post: Post;
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  console.log('🚀 PostCard RENDERING:', { 
    postId: post?.id, 
    postStatus: post?.status,
    hasMediaUrls: !!post?.media_urls,
    mediaUrlsCount: post?.media_urls?.length || 0,
    hasThumbnailUrls: !!post?.thumbnail_urls,
    thumbnailUrlsCount: post?.thumbnail_urls?.length || 0
  });

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const { refreshPosts, refreshAllPosts } = useWorkspace();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { canViewDrafts, canManagePosts } = useWorkspacePermissions();


  
  const statusConfig = POST_STATUSES[post.status];
  const typeConfig = POST_TYPES[post.post_type];
  
  const handleDownloadMedia = async () => {
    if (!post.media_urls || post.media_urls.length === 0) {
      toast({
        title: t('common.noMediaFound'),
        description: t('common.noMediaDescription'),
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
      for (let i = 0; i < post.media_urls.length; i++) {
        const url = normalizeMediaUrl(post.media_urls[i]);
        
        // Extract filename from URL
        const urlPath = new URL(url).pathname;
        const filename = urlPath.split('/').pop() || `media-${post.id}-${i + 1}`;
        
        // Call edge function to download media
        const downloadUrl = `https://lqbpqecybxdylqjedwza.supabase.co/functions/v1/download-media?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
        
        // Download via edge function
        const response = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to download ${filename}`);
        }

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(blobUrl);
      }

      toast({
        title: t('common.downloadCompleted'),
        description: `${post.media_urls.length} ${t('common.downloadDescription')}`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: t('common.downloadError'),
        description: t('common.downloadErrorDescription'),
        variant: "destructive",
        duration: 3000,
      });
    }
  };
  
  const handleCopyCaption = async () => {
    if (!post.caption) return;
    
    try {
      await navigator.clipboard.writeText(post.caption);
      toast({
        title: t('common.captionCopied'),
        duration: 2000,
      });
    } catch (error) {
      console.error('Copy caption error:', error);
      toast({
        title: t('common.copyError'),
        description: t('common.copyErrorDescription'),
        variant: "destructive",
        duration: 2000,
      });
    }
  };
  
  const handleDeletePost = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      console.log('[DELETE] Iniciando exclusão do post:', post.id);
      
      // Delete the post (trigger will mark media for deletion)
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);

      if (error) {
        console.error('[DELETE] Erro ao deletar post:', error);
        toast({
          title: t('common.error'),
          description: 'Erro ao deletar post',
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      console.log('[DELETE] Post deletado, mídia será limpa automaticamente pelo trigger SQL');

      // Call cleanup function to process pending media deletions immediately
      try {
        await supabase.functions.invoke('cleanup-deleted-media', {
          body: { workspace_id: post.workspace_id }
        });
        console.log('[DELETE] Limpeza de mídia R2 executada com sucesso');
      } catch (cleanupError) {
        console.warn('[DELETE] Aviso na limpeza de mídia:', cleanupError);
        // Don't fail the post deletion if cleanup fails
      }

      toast({
        title: 'Post deletado',
        description: 'O post foi removido com sucesso',
        duration: 2000,
      });

      // Refresh posts
      await refreshPosts();
      await refreshAllPosts();
    } catch (error) {
      console.error('[DELETE] Exceção durante exclusão:', error);
      toast({
        title: t('common.error'),
        description: 'Erro ao deletar post',
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Cleanup function removed - SQL trigger handles media deletion automatically

  const handleManualCleanup = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      console.log('[MANUAL_CLEANUP] Iniciando limpeza manual...');
      
      toast({
        title: 'Iniciando limpeza',
        description: 'Processando mídia pendente...',
        duration: 2000,
      });

      const { data, error } = await supabase.functions.invoke('cleanup-deleted-media', {
        body: { 
          trigger: 'manual',
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        console.error('[MANUAL_CLEANUP] Erro:', error);
        toast({
          title: 'Erro na limpeza',
          description: `Falha: ${error.message || 'Erro desconhecido'}`,
          variant: "destructive",
          duration: 4000,
        });
        return;
      }

      console.log('[MANUAL_CLEANUP] Resultado:', data);
      toast({
        title: 'Limpeza manual concluída',
        description: `Processadas ${data?.processed || 0} mídia(s)`,
        duration: 3000,
      });

    } catch (error) {
      console.error('[MANUAL_CLEANUP] Exceção:', error);
      toast({
        title: 'Erro na limpeza manual',
        description: 'Falha inesperada durante a operação',
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const handleUpdateStatus = async (newStatus: typeof post.status) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase
        .from('posts')
        .update({ status: newStatus })
        .eq('id', post.id);

      if (error) {
        console.error('Status update error:', error);
        return;
      }

      // Show success toast
      toast({
        title: t('common.statusUpdated'),
        description: `Post ${newStatus.toLowerCase()}`,
        duration: 2000,
      });

      // Refresh posts without page reload
      await refreshPosts();
      await refreshAllPosts();
    } catch (error) {
      console.error('Status update exception:', error);
    }
  };

  const handlePostAction = async () => {
    if (post.status !== 'Aprovado') return;

    console.log('🚀 [POST ACTION] Starting post action for post:', post.id);
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Show loading toast
      toast({
        title: t('common.processing'),
        description: t('common.pleaseWait'),
        duration: 2000,
      });

      // 1. Update status to "Postado"
      console.log('📝 [POST ACTION] Step 1: Updating status to Postado');
      const { error: updateError } = await supabase
        .from('posts')
        .update({ status: 'Postado' })
        .eq('id', post.id);

      if (updateError) {
        throw updateError;
      }
      console.log('✅ [POST ACTION] Step 1: Status updated successfully');

      // 2. Copy caption to clipboard (independent execution)
      console.log('📋 [POST ACTION] Step 2: Attempting to copy caption');
      if (post.caption) {
        try {
          await handleCopyCaption();
          console.log('✅ [POST ACTION] Step 2: Caption copied successfully');
        } catch (captionError) {
          console.error('⚠️ [POST ACTION] Step 2: Caption copy failed but continuing:', captionError);
          // Continue execution even if caption copy fails
        }
      } else {
        console.log('ℹ️ [POST ACTION] Step 2: No caption to copy');
      }

      // 3. Download all media files (independent execution)
      console.log('📥 [POST ACTION] Step 3: Attempting to download media');
      if (post.media_urls && post.media_urls.length > 0) {
        try {
          await handleDownloadMedia();
          console.log('✅ [POST ACTION] Step 3: Media downloaded successfully');
        } catch (downloadError) {
          console.error('⚠️ [POST ACTION] Step 3: Download failed but continuing:', downloadError);
          // Continue execution even if download fails
        }
      } else {
        console.log('ℹ️ [POST ACTION] Step 3: No media to download');
      }

      // 4. Show success message
      console.log('🎉 [POST ACTION] Step 4: Showing success message');
      toast({
        title: t('common.postPublished'),
        description: t('common.postPublishedDescription'),
        duration: 3000,
      });

      // 5. Refresh posts
      console.log('🔄 [POST ACTION] Step 5: Refreshing posts');
      await refreshPosts();
      await refreshAllPosts();
      console.log('✅ [POST ACTION] Post action completed successfully');

    } catch (error) {
      console.error('❌ [POST ACTION] Critical error:', error);
      toast({
        title: t('common.error'),
        description: t('common.statusUpdateError'),
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const handleRejectPost = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: t('post.reasonRequired'),
        description: t('post.reasonRequiredDescription'),
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (!profile?.id) {
      toast({
        title: t('common.error'),
        description: t('common.userNotAuthenticated'),
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
        .eq('id', post.id);

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
          post_id: post.id,
          user_id: profile.id,
          comment: `[REPROVAÇÃO] ${rejectionReason.trim()}`
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
      setRejectionDialogOpen(false);
      setRejectionReason('');
      await refreshPosts();
      await refreshAllPosts();
    } catch (error) {
      console.error('Rejection process error:', error);
      toast({
        title: t('common.error'),
        description: t('post.rejectPost'),
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleSendToApproval = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase
        .from('posts')
        .update({ status: 'Pendente' })
        .eq('id', post.id);

      if (error) {
        console.error('Send to approval error:', error);
        toast({
          title: t('common.error'),
          description: 'Erro ao enviar para aprovação',
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      toast({
        title: 'Enviado para aprovação',
        description: 'O rascunho foi enviado para aprovação',
        duration: 2000,
      });

      await refreshPosts();
      await refreshAllPosts();
    } catch (error) {
      console.error('Send to approval exception:', error);
    }
  };

  // Don't show drafts to non-owners
  if (post.status === 'Rascunho' && !canViewDrafts()) {
    return null;
  }

  return (
    <>
      <Card className="elegant-card group overflow-hidden">
        {/* Status header with semantic colors */}
        <div className={`px-4 py-3 flex items-center justify-between text-xs font-medium text-white ${
          post.status === 'Rascunho' ? 'bg-[hsl(var(--draft))]' :
          post.status === 'Pendente' ? 'bg-pending' :
          post.status === 'Aprovado' ? 'bg-approved' :
          post.status === 'Reprovado' ? 'bg-rejected' :
          post.status === 'Revisado' ? 'bg-reviewed' :
          post.status === 'Programado' ? 'bg-scheduled' :
          post.status === 'Postado' ? 'bg-[#64728f]' :
          post.status === 'Uploading' ? 'bg-gray-600' :
          post.status === 'Erro' ? 'bg-[hsl(var(--rejected))]' :
          'bg-muted'
        }`}>
          <span className="flex items-center gap-2">
            {t(`status.${post.status}`)}
            {post.status === 'Uploading' && post.upload_progress && (
              <>
                <span className="font-semibold">
                  ({Math.round((post.upload_progress.completed / post.upload_progress.total) * 100)}%)
                </span>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              </>
            )}
            {post.status === 'Uploading' && !post.upload_progress && (
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            )}
          </span>
          <div className="flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            {post.scheduled_for 
              ? formatDate(post.scheduled_for, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language)
              : formatDate(post.created_at, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language)
            }
          </div>
        </div>

        {/* Upload Progress Indicator for Uploading status */}
        {post.status === 'Uploading' && post.upload_progress && (
          <div className="mt-2 space-y-2 p-3 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">
                {t('post.uploadingFiles')}
              </span>
              <span className="font-medium">
                {t('post.filesCompleted', { 
                  completed: post.upload_progress.completed, 
                  total: post.upload_progress.total 
                })}
              </span>
            </div>
            
            {/* Overall Progress Bar */}
            <Progress 
              value={Math.round((post.upload_progress.completed / post.upload_progress.total) * 100)} 
              className="h-2"
            />
            
            {/* Individual file progress (show only uploading files) */}
            {post.upload_progress.files
              .filter(f => f.status === 'uploading')
              .slice(0, 2)
              .map((file, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="truncate max-w-[180px]" title={file.name}>
                      {file.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {file.uploadSpeed && (
                        <span>{file.uploadSpeed} KB/s</span>
                      )}
                      <span className="font-medium">{file.percentage}%</span>
                    </div>
                  </div>
                  <Progress value={file.percentage} className="h-1" />
                </div>
              ))
            }
            
            {/* Show count of remaining files if more than 2 */}
            {post.upload_progress.files.filter(f => f.status === 'uploading').length > 2 && (
              <p className="text-[10px] text-muted-foreground text-center">
                {t('post.moreUploading', { 
                  count: post.upload_progress.files.filter(f => f.status === 'uploading').length - 2 
                })}
              </p>
            )}
          </div>
        )}

        <CardContent className="p-6 flex flex-col min-h-[420px]">
          <div className="flex-1 space-y-4">
            {/* Post Type and Platforms */}
            <div className="flex items-center flex-wrap gap-3">
              <span className="text-sm font-display font-semibold text-foreground">
                {typeConfig?.label || t('common.typeNotDefined')}
              </span>
              {post.platforms.map((platform) => (
                 <Badge
                   key={platform}
                   variant="secondary"
                   className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium shadow-soft hover:shadow-medium transition-all"
                 >
                  {platform === 'Facebook' && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  )}
                  {platform === 'Instagram' && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  )}
                  {platform === 'LinkedIn' && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  )}
                  {platform === 'X' && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  )}
                  {PLATFORMS[platform] && (
                    <span>{PLATFORMS[platform].label}</span>
                  )}
                </Badge>
              ))}
            </div>

            {/* Media Preview */}
            {post.media_urls && post.media_urls.length > 0 && (
              <div className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer" onClick={() => setDetailsOpen(true)}>
                {(() => {
                  const firstMediaUrl = post.media_urls[0];
                  if (!firstMediaUrl) return null;
                  
                  // SIMPLIFIED: Use exact same logic as DebugCard that works
                  const thumbnail = getThumbnailSync(firstMediaUrl, post.thumbnail_urls, 0);
                  const finalUrl = thumbnail.thumbnailUrl || firstMediaUrl;
                  console.log('🎯 PostCard finalUrl:', { finalUrl, thumbnailUrl: thumbnail.thumbnailUrl, firstMediaUrl });
                  
                  return (
                    <div className="relative w-full h-full">
                      <MediaThumbnail
                        url={finalUrl}
                        isLoading={false}
                        isVideo={thumbnail.isVideo}
                        alt="Media preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  );
                })()}
                
                {/* Media count indicator */}
                {post.media_urls.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    {post.media_urls.length} itens
                  </div>
                )}
              </div>
            )}

            {/* DEBUG AREA: Separate comparison section */}
            {post.media_urls && post.media_urls.length > 0 && (() => {
              const firstMediaUrl = post.media_urls[0];
              const thumbnail = getThumbnailSync(firstMediaUrl, post.thumbnail_urls, 0);
              const finalUrl = thumbnail.thumbnailUrl || firstMediaUrl;
              
              return (
                <MediaThumbnail
                  url={finalUrl}
                  isLoading={false}
                  isVideo={thumbnail.isVideo}
                  alt="Post media"
                  className="w-full h-full"
                />
              );
            })()}

            {/* Caption */}
            {post.caption && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {post.caption}
                </p>
                {post.caption.length > 150 && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-xs"
                    onClick={() => setDetailsOpen(true)}
                  >
                    {t('common.readMore')}
                  </Button>
                )}
              </div>
            )}

          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setDetailsOpen(true)}
              className="flex-1"
            >
              <Eye className="h-4 w-4 mr-2" />
              {t('common.viewDetails')}
            </Button>

            {/* Status-specific action buttons */}
            {post.status === 'Rascunho' && canManagePosts() && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSendToApproval}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar para aprovação
              </Button>
            )}

            {(post.status === 'Pendente' || post.status === 'Revisado') && canManagePosts() && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleUpdateStatus('Aprovado')}
                  className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {t('common.approve')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setRejectionDialogOpen(true)}
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('common.reject')}
                </Button>
              </>
            )}

            {post.status === 'Aprovado' && canManagePosts() && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleUpdateStatus('Programado')}
                  className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {t('common.schedule')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePostAction}
                  className="flex-1 text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {t('common.post')}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Post Details Modal */}
      <PostDetailsModal 
        post={post}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('post.rejectPost')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('post.rejectReason')}
            </p>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t('post.rejectReasonPlaceholder')}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectionDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectPost}
              disabled={!rejectionReason.trim()}
            >
              {t('common.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostCard;