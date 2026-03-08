import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Calendar, FileText, Plus, LogOut, Clock, CheckCircle, UserCircle, Settings, User } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CreateWorkspaceModal from '@/components/CreateWorkspaceModal';
import WorkspaceUsersModal from '@/components/WorkspaceUsersModal';
import WorkspaceSettingsModal from '@/components/WorkspaceSettingsModal';
import GeneralCalendarView from '@/components/GeneralCalendarView';
import { LanguageSelector } from '@/components/LanguageSelector';
import { BillingNotifications } from '@/components/BillingComponents';
import GeneralPostAnalytics from '@/components/GeneralPostAnalytics';
import { OnboardingHero } from '@/components/onboarding/OnboardingHero';
import { OnboardingSteps } from '@/components/onboarding/OnboardingSteps';
import { OnboardingActions } from '@/components/onboarding/OnboardingActions';
import { OnboardingBenefits } from '@/components/onboarding/OnboardingBenefits';
import { LoadingState } from '@/components/LoadingState';
import { NotificationButton } from '@/components/NotificationButton';
import { EarlyAdopterIndicator } from '@/components/EarlyAdopterIndicator';


const Dashboard = () => {
  const { t } = useTranslation();
  const { profile, user, loading: authLoading, signOut } = useAuth();
  const { workspaces, allPosts, loading } = useWorkspace();
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<{ id: string; name: string; description?: string } | null>(null);
  const [selectedWorkspaceForSettings, setSelectedWorkspaceForSettings] = useState<any>(null);
  const [userEntitlements, setUserEntitlements] = useState<any>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle Instagram OAuth callback
  useEffect(() => {
    const instagramSuccess = searchParams.get('instagram_success');
    const instagramError = searchParams.get('instagram_error');

    if (instagramSuccess === 'true') {
      toast.success(t('instagram.connection_success'));
      // Clean up URL parameters
      searchParams.delete('instagram_success');
      setSearchParams(searchParams);
    }

    if (instagramError) {
      toast.error(t('instagram.connection_error'), {
        description: instagramError,
      });
      // Clean up URL parameters
      searchParams.delete('instagram_error');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, t]);

  // Fetch user entitlements
  useEffect(() => {
    if (user) {
      const fetchEntitlements = async () => {
        const { data } = await supabase.rpc('get_user_entitlements', { user_uuid: user.id });
        if (data && data.length > 0) {
          setUserEntitlements(data[0]);
        }
      };
      fetchEntitlements();
    }
  }, [user]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Show loading while checking auth or data is loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">21M Space</h1>
          <p className="text-muted-foreground mt-2">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, return null (will redirect)
  if (!user) {
    return null;
  }

  // Calculate overall statistics using allPosts
  console.log('Dashboard allPosts:', allPosts); // Debug log
  const totalPosts = allPosts.length;
  const pendingPosts = allPosts.filter(p => p.status === 'Pendente' || p.status === 'Rascunho').length;
  const approvedPosts = allPosts.filter(p => p.status === 'Aprovado').length;
  const rejectedPosts = allPosts.filter(p => p.status === 'Reprovado' || p.status === 'Erro').length;
  const scheduledPosts = allPosts.filter(p => p.status === 'Programado').length;
  const postedPosts = allPosts.filter(p => p.status === 'Postado').length;
  
  console.log('Dashboard stats:', { totalPosts, pendingPosts, approvedPosts, rejectedPosts, scheduledPosts, postedPosts }); // Debug log

  // Get posts by workspace for individual statistics
  const getWorkspaceStats = (workspaceId: string) => {
    const workspacePosts = allPosts.filter(p => p.workspace_id === workspaceId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const todayPosts = workspacePosts.filter(p => {
      const postDate = new Date(p.scheduled_for || p.created_at);
      return postDate >= today && postDate < tomorrow;
    });
    
    return {
      total: workspacePosts.length,
      pending: workspacePosts.filter(p => p.status === 'Pendente').length,
      approved: workspacePosts.filter(p => p.status === 'Aprovado').length,
      today: todayPosts.length,
    };
  };

  const handleShowWorkspaceUsers = (workspace: { id: string; name: string }) => {
    setSelectedWorkspace(workspace);
    setUsersModalOpen(true);
  };

  const handleShowWorkspaceSettings = (workspace: any) => {
    console.log('Opening workspace settings for workspace:', workspace);
    setSelectedWorkspaceForSettings(workspace);
    setSettingsModalOpen(true);
  };

  // Check if user can create a workspace based on entitlements
  
  const canCreateWorkspace = userEntitlements 
    ? workspaces.length < userEntitlements.max_owned_workspaces || userEntitlements.max_owned_workspaces === -1
    : false;

  const handleCreateWorkspaceClick = () => {
    if (canCreateWorkspace) {
      setCreateWorkspaceOpen(true);
    }
    // If not able to create workspace, the popover content will handle it
  };

  // Show enhanced onboarding screen if user has no workspaces
  if (workspaces.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0">
                21M
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">{t('dashboard.title')}</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <div className="hidden md:block text-sm text-muted-foreground">
                {profile?.username || profile?.email}
              </div>
              <NotificationButton />
              <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="h-8 w-8 sm:h-9 sm:w-9 p-0">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={signOut} className="h-8 px-2 sm:px-3">
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline ml-2">{t('dashboard.logout')}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

        {/* Enhanced Onboarding Content */}
        <main className="container mx-auto px-6 py-8">
          <div className="space-y-12 animate-fade-in">
            {/* Hero Section with prominent CTA */}
            <OnboardingHero onCreateWorkspace={() => setCreateWorkspaceOpen(true)} isModalOpen={createWorkspaceOpen} />
            
            {/* How it Works Steps - more compact */}
            <OnboardingSteps />
          </div>
        </main>

        <CreateWorkspaceModal
          open={createWorkspaceOpen}
          onOpenChange={setCreateWorkspaceOpen}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-outer">
      {/* Header */}
      <header className="border-b bg-gradient-subtle backdrop-blur-sm shadow-soft">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-xs sm:text-sm shadow-glow hover-glow flex-shrink-0">
                21M
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl md:text-3xl font-display font-bold text-foreground truncate">{t('generalDashboard.title')}</h1>
                <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground font-medium truncate">
                  {t('generalDashboard.description')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <div className="hidden md:flex text-sm text-muted-foreground font-medium px-3 py-2 rounded-lg bg-muted/50">
                {profile?.username || profile?.email} | {profile?.role}
              </div>
              <EarlyAdopterIndicator />
              <NotificationButton />
              <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="h-8 w-8 sm:h-9 sm:w-9 p-0">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={signOut} className="h-8 px-2 sm:px-3">
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline ml-2">{t('dashboard.logout')}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Billing Notifications */}
        <BillingNotifications />
        
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

        {/* Tabs */}
        <Tabs defaultValue="workspaces" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3 h-auto">
            <TabsTrigger value="workspaces" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">{t('dashboard.tabs.workspaces')}</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">{t('dashboard.tabs.calendar')}</span>
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate">{t('analytics.title')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workspaces" className="mt-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{t('dashboard.tabs.workspaces')}</h2>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button onClick={handleCreateWorkspaceClick}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('workspace.create')}
                    </Button>
                  </PopoverTrigger>
                  {!canCreateWorkspace && (
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium">{t('workspaceUpgrade.limitReached')}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t('workspaceUpgrade.limitReachedDescription')}
                          </p>
                        </div>
                        <Button asChild variant="default" className="w-full">
                          <a 
                            id="checkout-btn-21m-upgrade" 
                            href="https://buy.stripe.com/5kQ9AU3NV44m9TVcFsasg04"
                          >
                            {t('workspaceUpgrade.upgradePlan')}
                          </a>
                        </Button>
                      </div>
                    </PopoverContent>
                  )}
                </Popover>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workspaces.map((workspace) => {
                  const stats = getWorkspaceStats(workspace.id);
                  return (
                    <Card 
                      key={workspace.id} 
                      className="hover:shadow-md transition-shadow overflow-hidden relative group flex flex-col h-full"
                    >
                      <div onClick={() => navigate(`/workspace/${workspace.id}`)} className="cursor-pointer flex-1 flex flex-col">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-medium">{workspace.name}</CardTitle>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShowWorkspaceUsers({ id: workspace.id, name: workspace.name });
                                }}
                              >
                                <UserCircle className="h-5 w-5 text-muted-foreground" />
                              </Button>
                              {/* Settings button - only visible for workspace owners */}
                              {workspace.owner_id === user?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowWorkspaceSettings(workspace);
                                  }}
                                >
                                  <Settings className="h-5 w-5 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {workspace.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {workspace.description}
                            </p>
                          )}
                        </CardHeader>
                        
                        <CardContent className="flex-1 flex flex-col justify-between p-6 pt-0">
                          {/* Individual workspace stats */}
                          <div className="flex items-center gap-4 mb-4">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-amber-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">{t('dashboard.pendingPosts')}</p>
                                <p className="font-semibold text-amber-500">{stats.pending}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <div>
                                <p className="text-xs text-muted-foreground">{t('dashboard.approvedPosts')}</p>
                                <p className="font-semibold text-green-500">{stats.approved}</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Blue background section - Always at bottom */}
                          <div className="bg-[#2D4BC9] text-white p-4 -mx-6 -mb-6 space-y-3 rounded-b-lg mt-auto">
                            {/* Today's info */}
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-white/80">{t('calendar.today')}: {stats.today} posts</span>
                              <span className="text-white font-semibold">{stats.total} total</span>
                            </div>
                            
                            {/* Platforms */}
                            <div className="flex flex-wrap gap-1">
                              {workspace.platforms?.map((platform) => (
                                <Badge key={platform} variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
                                  {platform}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <GeneralCalendarView posts={allPosts} workspaces={workspaces} />
          </TabsContent>

          <TabsContent value="posts" className="mt-6">
            <GeneralPostAnalytics />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <CreateWorkspaceModal 
        open={createWorkspaceOpen} 
        onOpenChange={setCreateWorkspaceOpen} 
      />
      
      {selectedWorkspace && (
        <WorkspaceUsersModal
          open={usersModalOpen}
          onOpenChange={setUsersModalOpen}
          workspaceId={selectedWorkspace.id}
          workspaceName={selectedWorkspace.name}
        />
      )}
      
      {selectedWorkspaceForSettings && (
        <WorkspaceSettingsModal
          open={settingsModalOpen}
          onOpenChange={setSettingsModalOpen}
          workspace={selectedWorkspaceForSettings}
        />
      )}
    </div>
  );
};

export default Dashboard;