import React, { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Plus, Copy, Download, Linkedin, Youtube } from 'lucide-react';
import { Post, POST_TYPES, PLATFORMS, POST_STATUSES } from '@/types';
import PostDetailsModal from './PostDetailsModal';
import { format, isSameDay, startOfDay, isToday } from 'date-fns';
import { pt, es, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';

interface CalendarViewProps {
  posts: Post[];
}

interface PostPill {
  post: Post;
  type: string;
  platforms: string[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ posts }) => {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { refreshPosts, refreshAllPosts } = useWorkspace();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showAllPosts, setShowAllPosts] = useState<Post[] | null>(null);

  // Group posts by date
  const postsByDate = useMemo(() => {
    const grouped: Record<string, Post[]> = {};
    
    posts.forEach(post => {
      if (post.scheduled_for) {
        const dateKey = format(new Date(post.scheduled_for), 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(post);
      }
    });
    
    return grouped;
  }, [posts]);

  // Get posts for today
  const todayPosts = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return postsByDate[today] || [];
  }, [postsByDate]);

  // Today's date for display
  const today = new Date();

  // Get posts for selected date
  const selectedDatePosts = useMemo(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return postsByDate[dateKey] || [];
  }, [postsByDate, selectedDate]);

  const getDayPosts = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return postsByDate[dateKey] || [];
  };

  const getPostTypeColor = (postType: string) => {
    const colors = {
      'Feed': 'bg-purple-500 text-white',
      'Carrossel': 'bg-green-500 text-white', 
      'Reels': 'bg-blue-500 text-white',
      'Storys': 'bg-yellow-500 text-black'
    };
    return colors[postType as keyof typeof colors] || 'bg-gray-500 text-white';
  };

  const getPlatformIcon = (platform: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'Instagram': (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
      'Facebook': (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      'LinkedIn': <Linkedin className="w-3 h-3" />,
      'YT': (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
      'X': (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
        </svg>
      ),
      'Pinterest': (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.372 0 12.017c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.199-2.405.042-3.441.219-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.373 11.99-12.009C24.007 5.372 18.631.001 12.007.001z"/>
        </svg>
      ),
      'Reddit': (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14.238 15.348c.085-.084.085-.221 0-.306-.465-.462-1.194-.687-2.238-.687-.043 0-.087.000-.126.000-.043 0-.087 0-.126 0-1.044 0-1.773.225-2.238.687-.085.085-.085.222 0 .306.085.084.222.084.307 0.379-.378.985-.378 1.238 0.378.378.985.378 1.238 0 .085-.084.222-.084.307 0zM9.777 13.017c0-.564.458-1.022 1.022-1.022.564 0 1.022.458 1.022 1.022 0 .564-.458 1.022-1.022 1.022-.564 0-1.022-.458-1.022-1.022zM13.199 13.017c0-.564.458-1.022 1.022-1.022.564 0 1.022.458 1.022 1.022 0 .564-.458 1.022-1.022 1.022-.564 0-1.022-.458-1.022-1.022zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c.628 0 1.139.511 1.139 1.139 0 .378-.149.719-.391.969.016.129.016.258 0 .386 0 1.996-2.278 3.622-5.1 3.622s-5.1-1.626-5.1-3.622c-.016-.128-.016-.257 0-.386-.242-.25-.391-.591-.391-.969 0-.628.511-1.139 1.139-1.139.35 0 .663.149.884.391 1.308-.96 3.055-1.577 5.006-1.577l1.139-3.622c.043-.129.172-.215.301-.172l2.278.511c.129-.378.463-.645.884-.645.511 0 .928.417.928.928s-.417.928-.928.928-.928-.417-.928-.928l-1.997-.43-.969 3.055c1.95 0 3.698.617 5.006 1.577.221-.242.534-.391.884-.391z"/>
        </svg>
      )
    };
    return iconMap[platform] || <span className="text-xs">?</span>;
  };

  const renderPostPill = (post: Post, index: number) => {
    const typeInitial = POST_TYPES[post.post_type]?.initial || post.post_type[0];
    const visiblePlatforms = post.platforms.slice(0, 2);
    const remainingCount = post.platforms.length - 2;
    const isRejected = post.status === 'Reprovado';

    return (
      <div
        key={post.id}
        className={`flex items-center space-x-1 ${getPostTypeColor(post.post_type)} ${isRejected ? 'opacity-50' : ''} px-2 py-1 rounded-full text-xs cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={() => setSelectedPost(post)}
      >
        <span className="font-semibold">{typeInitial}</span>
        <div className="flex items-center space-x-0.5">
          {visiblePlatforms.map((platform, i) => (
            <span key={i} className="flex items-center">
              {getPlatformIcon(platform)}
            </span>
          ))}
          {remainingCount > 0 && (
            <span className="text-xs font-medium">+{remainingCount}</span>
          )}
        </div>
      </div>
    );
  };

  const copyCaption = async (caption?: string) => {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      toast({
        title: t('post.captionCopied'),
        description: t('common.captionCopiedDescription'),
      });
    } catch (err) {
      toast({
        title: t('common.copyError'),
        description: t('common.copyErrorDescription'),
        variant: "destructive",
      });
    }
  };

  const downloadMedia = async (mediaUrls?: string[]) => {
    if (!mediaUrls || mediaUrls.length === 0) {
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
      for (let i = 0; i < mediaUrls.length; i++) {
        const url = mediaUrls[i];
        
        // Extract filename from URL
        const urlPath = new URL(url).pathname;
        const filename = urlPath.split('/').pop() || `media-${i + 1}`;
        
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
        description: `${mediaUrls.length} ${t('common.downloadDescription')}`,
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

  const handlePostAction = async (post: Post) => {
    if (post.status !== 'Aprovado') return;

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Show loading toast
      toast({
        title: t('common.processing'),
        description: t('common.pleaseWait'),
        duration: 2000,
      });

      // 1. Update status to "Postado"
      const { error: updateError } = await supabase
        .from('posts')
        .update({ status: 'Postado' })
        .eq('id', post.id);

      if (updateError) {
        throw updateError;
      }

      // 2. Copy caption to clipboard
      if (post.caption) {
        await copyCaption(post.caption);
      }

      // 3. Download all media files
      if (post.media_urls && post.media_urls.length > 0) {
        await downloadMedia(post.media_urls);
      }

      // 4. Show success message
      toast({
        title: t('common.postPublished'),
        description: t('common.postPublishedDescription'),
        duration: 3000,
      });

      // 5. Refresh posts
      await refreshPosts();
      await refreshAllPosts();

    } catch (error) {
      console.error('Post action error:', error);
      toast({
        title: t('common.error'),
        description: t('common.statusUpdateError'),
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const renderDayContent = (date: Date, isCurrentMonth: boolean) => {
    const dayPosts = getDayPosts(date);
    const isCurrentDay = isToday(date);
    
    return (
      <div 
        className={`p-1 min-h-[80px] ${isCurrentDay ? 'ring-2 ring-primary' : ''} ${!isCurrentMonth ? 'opacity-40' : ''} relative cursor-pointer hover:bg-muted/20 transition-colors flex flex-col h-full`}
        onClick={() => setSelectedDate(date)}
      >
        <div className={`text-sm font-medium mb-1 ${!isCurrentMonth ? 'text-muted-foreground' : ''}`}>
          {format(date, 'd')}
        </div>
        
        <div className="flex-1 relative">
          <div className="grid grid-cols-2 gap-1">
            {dayPosts.slice(0, 4).map((post, index) => (
              <div key={post.id} className={!isCurrentMonth ? 'opacity-50' : ''}>
                {renderPostPill(post, index)}
              </div>
            ))}
          </div>
        </div>
        
        {dayPosts.length > 4 && (
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-6 w-6 p-0 text-xs rounded-full bg-background border-2 hover:bg-muted ${!isCurrentMonth ? 'opacity-50' : ''}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  +{dayPosts.length - 4}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    {t('calendar.postsOf')} {formatDate(date, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language)}
                  </div>
                  {dayPosts.map((post, index) => (
                    <div key={post.id} className="w-full">
                      {renderPostPill(post, index)}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Top Section - Posts de Hoje */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('calendar.todayPosts')}</CardTitle>
        </CardHeader>
        <CardContent>
          {todayPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('calendar.noPosts')}</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {todayPosts.map((post) => {
                const isRejected = post.status === 'Reprovado';
                return (
                  <div
                    key={post.id}
                    className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20 transition-colors relative ${isRejected ? 'opacity-60' : ''} ${post.status !== 'Aprovado' ? 'cursor-pointer' : ''}`}
                    onClick={post.status !== 'Aprovado' ? () => setSelectedPost(post) : undefined}
                  >
                    {/* Faixa vertical colorida */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${getPostTypeColor(post.post_type)} rounded-l-lg`}></div>
                  
                  <div className="flex items-center space-x-3 flex-1 ml-3 min-w-0">
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <div className="flex items-center space-x-2">
                        {post.platforms.slice(0, 4).map((platform, i) => (
                          <span key={i} className="flex items-center">
                            {getPlatformIcon(platform)}
                          </span>
                        ))}
                        {post.platforms.length > 4 && (
                          <span className="text-sm text-muted-foreground font-medium">
                            +{post.platforms.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{POST_TYPES[post.post_type]?.label}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {post.caption ? 
                          post.caption.length > 50 ? 
                            `${post.caption.substring(0, 50)}...` : 
                            post.caption
                           : t('post.noCaption')
                        }
                      </div>
                    </div>
                    
                    <Badge 
                      variant="secondary" 
                      className={`${POST_STATUSES[post.status]?.color} text-xs flex-shrink-0`}
                    >
                      {POST_STATUSES[post.status]?.label}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {post.status === 'Aprovado' ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePostAction(post);
                        }}
                      >
                        {t('post.post')}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyCaption(post.caption);
                          }}
                          disabled={!post.caption}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadMedia(post.media_urls);
                          }}
                          disabled={!post.media_urls || post.media_urls.length === 0}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-6">
          {/* Month name header with navigation */}
          <div className="flex items-center justify-center space-x-4 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[200px] text-center">
              {format(selectedDate, 'MMMM yyyy', { 
                locale: i18n.language === 'pt' ? pt : i18n.language === 'es' ? es : enUS 
              })}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-7 gap-0 border rounded-lg overflow-hidden">
            {/* Headers */}
            {[
              t('calendar.weekdays.sun'),
              t('calendar.weekdays.mon'),
              t('calendar.weekdays.tue'),
              t('calendar.weekdays.wed'),
              t('calendar.weekdays.thu'),
              t('calendar.weekdays.fri'),
              t('calendar.weekdays.sat')
            ].map((day) => (
              <div key={day} className="bg-muted p-3 text-center font-medium text-sm border-r border-b last:border-r-0">
                {day}
              </div>
            ))}
            
            {/* Days */}
            {Array.from({ length: 42 }, (_, i) => {
              const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i - new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay() + 1);
              const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
              
              return (
                <div
                  key={i}
                  className={`border-r border-b last:border-r-0 ${!isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''}`}
                  style={{ height: '90px' }}
                >
                  {renderDayContent(date, isCurrentMonth)}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Posts da Data Selecionada - Always shown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('calendar.postsOf')} {format(selectedDate, 'dd/MM/yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDatePosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('calendar.noPostsScheduled')} {format(selectedDate, 'dd/MM/yyyy')}.</p>
          ) : (
            <div className="space-y-3">
              {selectedDatePosts.map((post) => {
                const isRejected = post.status === 'Reprovado';
                return (
                  <div
                    key={post.id}
                    className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20 transition-colors cursor-pointer ${isRejected ? 'opacity-60' : ''}`}
                    onClick={() => setSelectedPost(post)}
                  >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <div className={`w-8 h-8 ${getPostTypeColor(post.post_type)} rounded-full flex items-center justify-center text-sm font-semibold`}>
                        {POST_TYPES[post.post_type]?.initial || post.post_type[0]}
                      </div>
                      <div className="flex items-center space-x-2">
                        {post.platforms.slice(0, 4).map((platform, i) => (
                          <span key={i} className="flex items-center">
                            {getPlatformIcon(platform)}
                          </span>
                        ))}
                        {post.platforms.length > 4 && (
                          <span className="text-sm text-muted-foreground font-medium">
                            +{post.platforms.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{POST_TYPES[post.post_type]?.label}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {post.caption ? 
                          post.caption.length > 50 ? 
                            `${post.caption.substring(0, 50)}...` : 
                            post.caption
                          : t('post.noCaption')
                        }
                      </div>
                    </div>
                    
                    <Badge 
                      variant="secondary" 
                      className={`${POST_STATUSES[post.status]?.color} text-xs flex-shrink-0`}
                    >
                      {POST_STATUSES[post.status]?.label}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {post.status === 'Aprovado' ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePostAction(post);
                        }}
                      >
                        {t('post.post')}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyCaption(post.caption);
                          }}
                          disabled={!post.caption}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadMedia(post.media_urls);
                          }}
                          disabled={!post.media_urls || post.media_urls.length === 0}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post Details Modal */}
      {selectedPost && (
        <PostDetailsModal
          post={selectedPost}
          open={!!selectedPost}
          onOpenChange={(open) => !open && setSelectedPost(null)}
        />
      )}

      {/* All Posts Modal */}
      {showAllPosts && (
        <PostDetailsModal
          post={showAllPosts[0]}
          open={!!showAllPosts}
          onOpenChange={(open) => !open && setShowAllPosts(null)}
          allPosts={showAllPosts}
        />
      )}
    </div>
  );
};

export default CalendarView;