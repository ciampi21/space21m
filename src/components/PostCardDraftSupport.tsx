import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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
  ImageIcon
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
import { MediaThumbnail } from '@/components/ui/media-thumbnail';
import { getThumbnailSync } from '@/utils/thumbnailUtils';

interface PostCardProps {
  post: Post;
}

const PostCardDraftSupport: React.FC<PostCardProps> = ({ post }) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const { refreshPosts, refreshAllPosts } = useWorkspace();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { canViewDrafts, canManagePosts } = useWorkspacePermissions();

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
      const { toast } = await import('@/hooks/use-toast');
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

  const handleRejectPost = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: t('common.error'),
        description: t('post.reasonRequired'),
        variant: "destructive",
      });
      return;
    }

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Update post status and rejection reason
      const { error: postError } = await supabase
        .from('posts')
        .update({ 
          status: 'Reprovado',
          rejection_reason: rejectionReason.trim()
        })
        .eq('id', post.id);

      if (postError) {
        console.error('Error rejecting post:', postError);
        toast({
          title: t('common.error'),
          description: t('post.updateError'),
          variant: "destructive",
        });
        return;
      }

      // Add rejection reason as a comment
      const { error: commentError } = await supabase
        .from('post_comments')
        .insert({
          post_id: post.id,
          user_id: profile.id,
          comment: rejectionReason.trim()
        });

      if (commentError) {
        console.error('Error creating rejection comment:', commentError);
        // Don't return here, as the post was already rejected successfully
      }

      toast({
        title: t('common.success'),
        description: t('post.postRejected'),
      });

      setRejectionDialogOpen(false);
      setRejectionReason('');
      refreshPosts();
      refreshAllPosts();
    } catch (error) {
      console.error('Error rejecting post:', error);
      toast({
        title: t('common.error'),
        description: t('post.updateError'),
        variant: "destructive",
      });
    }
  };

  // Download media function with error handling
  const handleDownloadMedia = async () => {
    if (!post.media_urls || post.media_urls.length === 0) {
      toast({
        title: t('common.noMedia'),
        description: t('common.noMediaDescription'),
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('📥 Starting media download for post:', post.id);
      
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const downloadPromises = post.media_urls.map(async (url, index) => {
        try {
          const normalizedUrl = normalizeMediaUrl(url);
          const filename = normalizedUrl.split('/').pop() || `media-${index + 1}`;
          
          // Construct full edge function URL with query parameters
          const supabaseUrl = 'https://lqbpqecybxdylqjedwza.supabase.co';
          const downloadUrl = `${supabaseUrl}/functions/v1/download-media?url=${encodeURIComponent(normalizedUrl)}&filename=${encodeURIComponent(filename)}`;
          
          // Make direct HTTP request with auth header
          const response = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYnBxZWN5YnhkeWxxamVkd3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNTk1NjMsImV4cCI6MjA2ODYzNTU2M30.-NN_DGqKaNghcnrzYW075KTg_f4W6i-z3n6y4Tq1L_U'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          // Convert response to blob
          const blob = await response.blob();
          
          // Create temporary download link
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          
          // Trigger download
          link.click();
          
          // Cleanup
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
          
          console.log(`✅ Downloaded: ${filename}`);
          return { success: true, filename };
        } catch (error) {
          console.error(`❌ Failed to download media ${index + 1}:`, error);
          return { success: false, error };
        }
      });

      const results = await Promise.allSettled(downloadPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
      
      if (successful > 0) {
        toast({
          title: t('common.downloadComplete'),
          description: `${successful} ${t('common.filesDownloaded')}`,
        });
      } else {
        throw new Error('All downloads failed');
      }
    } catch (error) {
      console.error('Download media error:', error);
      toast({
        title: t('common.downloadError'),
        description: t('common.downloadErrorDescription'),
        variant: "destructive",
      });
      throw error;
    }
  };

  // Copy caption function with error handling
  const handleCopyCaption = async () => {
    if (!post.caption) {
      toast({
        title: t('common.noCaption'),
        description: t('common.noCaptionDescription'),
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(post.caption);
      toast({
        title: t('common.captionCopied'),
        description: t('common.captionCopiedDescription'),
      });
    } catch (error) {
      console.error('Copy caption error:', error);
      toast({
        title: t('common.copyError'),
        description: t('common.copyErrorDescription'),
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle post action (Approve → Copy → Download → Success)
  const handlePostAction = async () => {
    if (post.status !== 'Aprovado') return;

    console.log('🚀 [POST ACTION] Starting post action for post:', post.id);
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
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

      // 2. Copy caption (independent execution)
      console.log('📋 [POST ACTION] Step 2: Attempting to copy caption');
      if (post.caption) {
        try {
          await handleCopyCaption();
          console.log('✅ [POST ACTION] Step 2: Caption copied successfully');
        } catch (captionError) {
          console.error('⚠️ [POST ACTION] Step 2: Caption copy failed but continuing:', captionError);
        }
      } else {
        console.log('ℹ️ [POST ACTION] Step 2: No caption to copy');
      }

      // 3. Download media (independent execution)
      console.log('📥 [POST ACTION] Step 3: Attempting to download media');
      if (post.media_urls && post.media_urls.length > 0) {
        try {
          await handleDownloadMedia();
          console.log('✅ [POST ACTION] Step 3: Media downloaded successfully');
        } catch (downloadError) {
          console.error('⚠️ [POST ACTION] Step 3: Download failed but continuing:', downloadError);
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
        variant: "destructive",
      });
    }
  };

  // Don't show drafts to non-owners
  if (post.status === 'Rascunho' && !canViewDrafts()) {
    return null;
  }

  const statusConfig = POST_STATUSES[post.status];
  const typeConfig = POST_TYPES[post.post_type];

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
          <span>{t(`status.${post.status}`)}</span>
          <div className="flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            {post.scheduled_for 
              ? formatDate(post.scheduled_for, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language)
              : formatDate(post.created_at, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language)
            }
          </div>
        </div>

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
                  <span>{PLATFORMS[platform].label}</span>
                </Badge>
              ))}
            </div>

            {/* Media Preview - Show first media as thumbnail */}
            {post.media_urls && post.media_urls.length > 0 ? (
              <div className="relative">
                <div className="relative w-full h-48 rounded-md overflow-hidden cursor-pointer bg-muted" onClick={() => setDetailsOpen(true)}>
                  {(() => {
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
                  {post.media_urls.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black/60 text-white rounded-full px-2 py-1 text-xs font-medium">
                      +{post.media_urls.length - 1}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-48 rounded-md bg-muted flex items-center justify-center cursor-pointer" onClick={() => setDetailsOpen(true)}>
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}

            {/* Caption */}
            {post.caption && (
              <p className="text-sm text-muted-foreground line-clamp-3 overflow-hidden">
                {post.caption}
              </p>
            )}

            {/* Comments Section */}
            {post.additional_comments && (
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="flex items-center text-sm font-medium mb-1">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t('common.comments')}:
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {post.additional_comments}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons - Always at bottom */}
          <div className="space-y-3 pt-4 mt-auto">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setDetailsOpen(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {t('common.viewDetails')}
            </Button>

            {/* Draft-specific actions - removed Edit and Resubmit button */}

            {/* Status Actions - Based on current status (only for non-drafts) */}
            {post.status === 'Pendente' && canManagePosts() && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="sm"
                  onClick={() => handleUpdateStatus('Aprovado')}
                  className="bg-approved hover:bg-approved/90 text-approved-foreground shadow-medium hover:shadow-large transition-all duration-200"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {t('common.approve')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setRejectionDialogOpen(true)}
                >
                  <X className="h-4 w-4 mr-1" />
                  {t('common.reject')}
                </Button>
              </div>
            )}

            {post.status === 'Aprovado' && canManagePosts() && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => handleUpdateStatus('Programado')}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {t('post.schedule')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={handlePostAction}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {t('post.post')}
                </Button>
              </div>
            )}

            {/* Removed Edit and Resubmit button for rejected posts */}
          </div>
        </CardContent>
      </Card>

      {detailsOpen && (
        <PostDetailsModal
          post={post}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('post.rejectPost')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('post.rejectReason')} *
              </label>
              <Textarea
                placeholder={t('post.rejectReasonPlaceholder')}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setRejectionDialogOpen(false);
                setRejectionReason('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectPost}
              disabled={!rejectionReason.trim()}
            >
              <X className="h-4 w-4 mr-2" />
              {t('post.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostCardDraftSupport;