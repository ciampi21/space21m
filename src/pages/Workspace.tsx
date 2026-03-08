import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Grid3X3, Plus, Settings, ArrowLeft, LogOut, Filter, BarChart3, RefreshCw } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';
import { useAuth } from '@/contexts/AuthContext';
import { POST_STATUSES, POST_TYPES, PLATFORMS } from '@/types';
import PostCard from '@/components/PostCardDraftSupport';
import CalendarView from '@/components/CalendarView';
import WorkspaceAnalytics from '@/components/WorkspaceAnalytics';
import CreatePostModal from '@/components/CreatePostModal';
import { NotificationButton } from '@/components/NotificationButton';
import { useWorkspacePermissions } from '@/hooks/useWorkspacePermissions';
import { FiltersPopover } from '@/components/FiltersPopover';
import { SortByDropdown } from '@/components/SortByDropdown';

const getPostTypeColor = (postType: string) => {
  const colors = {
    'Feed': 'bg-purple-500 text-white',
    'Carrossel': 'bg-green-500 text-white',
    'Reels': 'bg-blue-500 text-white',
    'Storys': 'bg-yellow-500 text-black'
  };
  return colors[postType as keyof typeof colors] || 'bg-gray-500 text-white';
};
const Workspace = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const {
    profile
  } = useAuth();
  const {
    t
  } = useTranslation();
  const {
    workspaces,
    posts,
    viewMode,
    filters,
    loading,
    setCurrentWorkspace,
    setViewMode,
    setFilters,
    refreshWorkspaces
  } = useWorkspace();
  const {
    canViewDrafts
  } = useWorkspacePermissions();
  const [currentView, setCurrentView] = useState<'grid' | 'calendar' | 'analytics'>('grid');
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'scheduled' | 'created'>('newest');

  // Find the current workspace
  const currentWorkspace = workspaces.find(w => w.id === id);

  // Check if user can view metrics based on workspace settings
  const canViewMetrics = () => {
    if (!currentWorkspace || !profile) return false;
    const visibility = currentWorkspace.metrics_visibility || 'owner_only';
    if (visibility === 'disabled') return false;
    if (visibility === 'all') return true;
    if (visibility === 'owner_only') {
      return currentWorkspace.owner_id === profile.user_id;
    }
    return false;
  };

  // Filter posts for this workspace and apply filters
  const workspacePosts = posts.filter(p => {
    // First filter by workspace
    if (p.workspace_id !== id) return false;

    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(p.status)) return false;
    }

    // Apply post type filter
    if (filters.type && filters.type.length > 0) {
      if (!filters.type.includes(p.post_type)) return false;
    }

    // Apply platform filter
    if (filters.platform && filters.platform.length > 0) {
      const hasMatchingPlatform = filters.platform.some(filterPlatform => p.platforms.includes(filterPlatform));
      if (!hasMatchingPlatform) return false;
    }
    return true;
  });

  // Sort posts based on selected option
  const sortedPosts = [...workspacePosts].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'scheduled':
        if (!a.scheduled_for) return 1
        if (!b.scheduled_for) return -1
        return new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      default:
        return 0
    }
  });

  // Calculate statistics for this workspace (use unfiltered posts for statistics)
  const allWorkspacePosts = posts.filter(p => p.workspace_id === id);
  const totalPosts = allWorkspacePosts.length;
  const draftPosts = allWorkspacePosts.filter(p => p.status === 'Rascunho').length;
  const pendingPosts = allWorkspacePosts.filter(p => p.status === 'Pendente' || p.status === 'Rascunho').length;
  const reviewedPosts = allWorkspacePosts.filter(p => p.status === 'Revisado').length;
  const rejectedPosts = allWorkspacePosts.filter(p => p.status === 'Reprovado' || p.status === 'Erro').length;
  const approvedPosts = allWorkspacePosts.filter(p => p.status === 'Aprovado').length;
  const scheduledPosts = allWorkspacePosts.filter(p => p.status === 'Programado').length;
  const postedPosts = allWorkspacePosts.filter(p => p.status === 'Postado').length;

  // Handle workspace refresh
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      console.log('Manually refreshing workspaces...');
      await refreshWorkspaces();
    } catch (error) {
      console.error('Error refreshing workspaces:', error);
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    if (currentWorkspace) {
      setCurrentWorkspace(currentWorkspace);
    }
  }, [currentWorkspace, setCurrentWorkspace]);

  // Enhanced workspace not found handling with retry option
  if (!loading && !currentWorkspace && !refreshing) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">{t('workspace.notFound')}</h1>
          <p className="text-muted-foreground">
            {t('workspace.notFoundDescription')}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? t('workspace.refreshing') : t('workspace.tryAgain')}
            </Button>
            <Button onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('workspace.backToDashboard')}
            </Button>
          </div>
        </div>
      </div>;
  }
  if (loading || !currentWorkspace) {
    return <div className="min-h-screen flex items-center justify-center bg-background-outer">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  return <div className="min-h-screen bg-background-outer">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0">
                21M
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl md:text-2xl font-bold text-foreground truncate">
                  {t('workspace.approvalPanel')} | {currentWorkspace.name}
                </h1>
                <p className="hidden md:block text-sm text-muted-foreground truncate">
                  {profile?.username || profile?.email} | {profile?.role}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <NotificationButton />
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="h-8 px-2 sm:px-3">
                <Settings className="h-4 w-4" />
                <span className="hidden lg:inline ml-2">{t('workspace.generalPanel')}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={async () => {
              const {
                supabase
              } = await import('@/integrations/supabase/client');
              await supabase.auth.signOut();
              navigate('/auth');
            }} className="h-8 px-2 sm:px-3">
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline ml-2">{t('workspace.exit')}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Mobile: Card consolidado de estatísticas */}
        <Card className="elegant-card md:hidden mb-6">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-x-4">
              {/* Coluna Esquerda */}
              <div className="space-y-0">
                <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dashboard.total')}
                  </span>
                  <span className="text-xl font-display font-bold text-foreground">
                    {totalPosts}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dashboard.pending')}
                  </span>
                  <span className="text-xl font-display font-bold text-pending">
                    {pendingPosts}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dashboard.rejected')}
                  </span>
                  <span className="text-xl font-display font-bold text-rejected">
                    {rejectedPosts}
                  </span>
                </div>
              </div>

              {/* Coluna Direita */}
              <div className="space-y-0">
                <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dashboard.approved')}
                  </span>
                  <span className="text-xl font-display font-bold text-approved">
                    {approvedPosts}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dashboard.scheduled')}
                  </span>
                  <span className="text-xl font-display font-bold text-scheduled">
                    {scheduledPosts}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dashboard.posted')}
                  </span>
                  <span className="text-xl font-display font-bold text-posted">
                    {postedPosts}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desktop: Grid de cards individuais */}
        <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="elegant-card hover-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.totalPosts')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-foreground">{totalPosts}</div>
            </CardContent>
          </Card>
          
          
          <Card className="elegant-card hover-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.pendingPosts')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-pending">{pendingPosts}</div>
            </CardContent>
          </Card>
          
          
          <Card className="elegant-card hover-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.rejectedPosts')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-rejected">{rejectedPosts}</div>
            </CardContent>
          </Card>
          
          <Card className="elegant-card hover-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.approvedPosts')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-approved">{approvedPosts}</div>
            </CardContent>
          </Card>
          
          <Card className="elegant-card hover-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.scheduledPosts')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-scheduled">{scheduledPosts}</div>
            </CardContent>
          </Card>
          
          <Card className="elegant-card hover-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.postedPosts')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-posted">{postedPosts}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and View Mode */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between mb-6">
          {/* Left side - Filters and Sort */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 sm:pb-0">
            {currentView === 'calendar' && (
              <div className="flex items-center space-x-4 sm:space-x-6 text-sm min-w-max">
                <span className="text-xs text-muted-foreground font-medium">{t('workspace.postTypes')}</span>
                <div className="flex items-center space-x-4">
                  {Object.entries(POST_TYPES).map(([key, { initial, label }]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <div className={`w-4 h-4 ${getPostTypeColor(key)} rounded-full flex items-center justify-center text-xs font-semibold`}>
                        {initial}
                      </div>
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {currentView === 'grid' && (
              <>
                <FiltersPopover 
                  filters={filters} 
                  onFiltersChange={setFilters}
                />
                
                <SortByDropdown
                  value={sortBy}
                  onChange={(value) => setSortBy(value as any)}
                />
              </>
            )}
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border p-1 self-end sm:self-auto">
            <Button variant={currentView === 'grid' ? 'default' : 'ghost'} size="sm" className="h-8 px-2 sm:px-3" onClick={() => {
            setCurrentView('grid');
            setViewMode('grid');
          }}>
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">{t('workspace.grid')}</span>
            </Button>
            <Button variant={currentView === 'calendar' ? 'default' : 'ghost'} size="sm" className="h-8 px-2 sm:px-3" onClick={() => {
            setCurrentView('calendar');
            setViewMode('calendar');
          }}>
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">{t('workspace.calendar')}</span>
            </Button>
            {canViewMetrics() && <Button variant={currentView === 'analytics' ? 'default' : 'ghost'} size="sm" className="h-8 px-2 sm:px-3" onClick={() => setCurrentView('analytics')}>
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">{t('analytics.title')}</span>
              </Button>}
            
            
          </div>
        </div>


        {/* Content */}
        {currentView === 'grid' ? <div className="space-y-4">
            
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('workspace.posts')}</h2>
              <span className="text-sm text-muted-foreground text-primary">
                {sortedPosts.length} {t('workspace.posts').toLowerCase()}
              </span>
            </div>
            
            {loading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({
            length: 8
          }).map((_, i) => <Card key={i} className="animate-pulse">
                    <div className="h-48 bg-muted rounded-t-lg" />
                    <CardContent className="p-4 space-y-2">
                      <div className="h-4 bg-muted rounded" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </CardContent>
                  </Card>)}
              </div> : workspacePosts.length === 0 ? <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {totalPosts === 0 
                    ? t('workspace.emptyWorkspace') 
                    : t('workspace.noPosts')}
                </p>
              </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedPosts.map(post => <PostCard key={post.id} post={post} />)}
              </div>}
          </div> : currentView === 'calendar' ? <CalendarView posts={sortedPosts} /> : <WorkspaceAnalytics workspaceId={id!} />}
      </div>

      {/* Fixed Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button onClick={() => setCreatePostOpen(true)} className="group relative h-16 w-16 rounded-full shadow-elegant hover:shadow-glow transition-all duration-700 ease-in-out overflow-hidden hover:w-52 bg-gradient-primary animate-pulse-glow">
          <Plus className="h-6 w-6 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 group-hover:opacity-0 transition-opacity duration-300" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-200 whitespace-nowrap font-medium">
            {t('workspace.addNewPost')}
          </span>
        </Button>
      </div>

      <CreatePostModal open={createPostOpen} onOpenChange={setCreatePostOpen} />
    </div>;
};
export default Workspace;