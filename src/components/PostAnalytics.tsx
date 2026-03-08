import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/dateUtils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  Plus,
  Users,
  History,
  Edit
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import i18n from '@/lib/i18n';

interface PostStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  published: number;
  scheduled: number;
}

interface PlatformStats {
  platform: string;
  count: number;
  percentage: number;
}

interface PostTypeStats {
  type: string;
  count: number;
}

interface MonthlyStats {
  month: string;
  posts: number;
  approved: number;
}

interface FollowerStats {
  id: string;
  platform: string;
  username: string;
  follower_count: number;
  week_start_date: string;
  created_at: string;
}

interface WeeklyFollowerData {
  week: string;
  [key: string]: string | number; // Dynamic platform keys
}

const PostAnalytics: React.FC = () => {
  const [stats, setStats] = useState<PostStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    published: 0,
    scheduled: 0
  });
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [historicalMonthlyStats, setHistoricalMonthlyStats] = useState<MonthlyStats[]>([]);
  const [followerStats, setFollowerStats] = useState<FollowerStats[]>([]);
  const [weeklyFollowerData, setWeeklyFollowerData] = useState<WeeklyFollowerData[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentWorkspace } = useWorkspace();
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();

  // Form states for adding follower data
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingFollowerStat, setEditingFollowerStat] = useState<FollowerStats | null>(null);
  const [formData, setFormData] = useState({
    platform: '',
    username: '',
    followerCount: '',
    weekStartDate: ''
  });

  // New states for inline editing
  const [isEditMode, setIsEditMode] = useState(false);
  const [showNewRow, setShowNewRow] = useState(false);
  const [newRowData, setNewRowData] = useState({
    platform: '',
    username: '',
    followerCount: '',
    weekStartDate: ''
  });
  const [editingRows, setEditingRows] = useState<{[key: string]: any}>({});

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];
  const platforms = ['Instagram', 'Facebook', 'LinkedIn', 'YT', 'X', 'Pinterest', 'Reddit'];
  
  // Get platforms that actually have data for the chart
  const getActivePlatforms = () => {
    const activePlatforms = new Set<string>();
    followerStats.forEach(stat => {
      activePlatforms.add(stat.platform);
    });
    return Array.from(activePlatforms);
  };

  // Custom tooltip for Pie Chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const { platform, count } = data.payload;
      const totalPosts = platformStats.reduce((sum, p) => sum + p.count, 0);
      const percentage = ((count / totalPosts) * 100).toFixed(1);
      
      return (
        <div className="bg-background/95 backdrop-blur-sm border-2 rounded-lg shadow-xl p-4 min-w-[180px]">
          <div className="flex items-center gap-3 mb-2">
            <div 
              className="w-4 h-4 rounded-full ring-2 ring-white shadow-md" 
              style={{ backgroundColor: data.fill }}
            />
            <p className="font-bold text-foreground text-base">{platform}</p>
          </div>
          <div className="space-y-1 pl-7">
            <p className="text-sm text-muted-foreground">
              Posts: <span className="font-semibold text-foreground">{count}</span>
            </p>
            <p className="text-lg font-bold text-primary">
              {percentage}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchAnalytics();
    }
  }, [currentWorkspace?.id]);

  const fetchAnalytics = async () => {
    if (!currentWorkspace?.id) return;

    setLoading(true);
    try {
      // Fetch current posts for real-time data
      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (error) {
        console.error('Error fetching posts:', error);
        return;
      }

      // Calculate general stats
      const totalPosts = posts?.length || 0;
      const postStats: PostStats = {
        total: totalPosts,
        pending: posts?.filter(p => p.status === 'Pendente').length || 0,
        approved: posts?.filter(p => p.status === 'Aprovado').length || 0,
        rejected: posts?.filter(p => p.status === 'Reprovado' || p.status === 'Erro').length || 0,
        published: posts?.filter(p => p.status === 'Postado').length || 0,
        scheduled: posts?.filter(p => p.status === 'Programado').length || 0,
      };
      setStats(postStats);

      // Calculate platform stats
      const platformCounts: Record<string, number> = {};
      posts?.forEach(post => {
        post.platforms?.forEach((platform: string) => {
          platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        });
      });

      const totalPlatformPosts = Object.values(platformCounts).reduce((a, b) => a + b, 0);
      const platformData: PlatformStats[] = Object.entries(platformCounts).map(([platform, count]) => ({
        platform,
        count,
        percentage: Math.round((count / totalPlatformPosts) * 100)
      }));
      setPlatformStats(platformData);

      // Fetch historical monthly analytics
      const { data: historicalData, error: historicalError } = await supabase
        .from('monthly_analytics')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (historicalError) {
        console.error('Error fetching historical data:', historicalError);
      }

      // Calculate current month stats from live posts
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      
      const currentMonthPosts = posts?.filter(post => {
        const postDate = new Date(post.created_at);
        return postDate.getFullYear() === currentYear && 
               postDate.getMonth() + 1 === currentMonth;
      }) || [];

      const currentMonthStats = {
        month: currentDate.toLocaleDateString(i18n.language, { month: 'short' }) + '/' + currentDate.getFullYear().toString().slice(-2),
        posts: currentMonthPosts.length,
        approved: currentMonthPosts.filter(p => p.status === 'Aprovado' || p.status === 'Postado').length
      };

      // Combine historical data with current month and last 5 months for fallback
      const combinedMonthlyStats: MonthlyStats[] = [];
      const monthlyData: Record<string, { posts: number; approved: number; month: string }> = {};
      
      // Create last 6 months structure as fallback
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthKey = date.toISOString().slice(0, 7);
        const monthName = date.toLocaleDateString(i18n.language, { month: 'short' });
        const year = date.getFullYear().toString().slice(-2);
        
        monthlyData[monthKey] = { 
          posts: 0, 
          approved: 0,
          month: `${monthName}/${year}`
        };
      }

      // Add historical data if available
      if (historicalData && historicalData.length > 0) {
        historicalData.forEach(record => {
          const date = new Date(record.year, record.month - 1);
          const monthName = date.toLocaleDateString(i18n.language, { month: 'short' });
          const year = record.year.toString().slice(-2);
          const monthKey = `${record.year}-${String(record.month).padStart(2, '0')}`;
          
          combinedMonthlyStats.push({
            month: `${monthName}/${year}`,
            posts: record.total_posts,
            approved: record.approved_posts
          });
        });
      } else {
        // Fallback to calculating from current posts for last 6 months
        posts?.forEach(post => {
          const postMonth = post.created_at.slice(0, 7);
          if (monthlyData[postMonth]) {
            monthlyData[postMonth].posts++;
            if (post.status === 'Aprovado' || post.status === 'Postado') {
              monthlyData[postMonth].approved++;
            }
          }
        });

        Object.entries(monthlyData).forEach(([monthKey, data]) => {
          combinedMonthlyStats.push({
            month: data.month,
            posts: data.posts,
            approved: data.approved
          });
        });
      }

      // Ensure current month is updated with live data
      const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const currentMonthIndex = combinedMonthlyStats.findIndex(stat => 
        stat.month === currentMonthStats.month
      );
      
      if (currentMonthIndex !== -1) {
        combinedMonthlyStats[currentMonthIndex] = currentMonthStats;
      } else if (combinedMonthlyStats.length === 0) {
        combinedMonthlyStats.push(currentMonthStats);
      }

      setMonthlyStats(combinedMonthlyStats);

      // Fetch follower stats
      await fetchFollowerStats();

    } catch (error) {
      console.error('Error in fetchAnalytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowerStats = async () => {
    if (!currentWorkspace?.id) return;

    try {
      const { data: followers, error } = await supabase
        .from('follower_stats')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('week_start_date', { ascending: true });

      if (error) {
        console.error('Error fetching follower stats:', error);
        return;
      }

      setFollowerStats(followers || []);

      // Process data for weekly chart - only include platforms with actual data
      const weeklyData: Record<string, WeeklyFollowerData> = {};
      const platformsWithData = new Set<string>();
      
      followers?.forEach(stat => {
        const weekKey = formatDate(stat.week_start_date, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language);
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { week: weekKey };
        }
        
        weeklyData[weekKey][stat.platform] = stat.follower_count;
        platformsWithData.add(stat.platform);
      });

      // Convert to array and ensure data consistency
      const chartData = Object.values(weeklyData);
      
      console.log('Follower chart data:', {
        followers: followers?.length || 0,
        chartData: chartData.length,
        platformsWithData: Array.from(platformsWithData),
        weeklyData: chartData
      });

      setWeeklyFollowerData(chartData);

    } catch (error) {
      console.error('Error fetching follower stats:', error);
    }
  };

  const handleAddNewRow = async () => {
    if (!currentWorkspace?.id || !newRowData.platform || !newRowData.username || !newRowData.followerCount || !newRowData.weekStartDate) {
      toast({
        title: t('common.error'),
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('follower_stats')
        .insert({
          workspace_id: currentWorkspace.id,
          platform: newRowData.platform,
          username: newRowData.username.startsWith('@') ? newRowData.username : `@${newRowData.username}`,
          follower_count: parseInt(newRowData.followerCount),
          week_start_date: newRowData.weekStartDate,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) {
        throw error;
      }

      toast({
        title: t('common.success'),
        description: "Dados de seguidores adicionados com sucesso!",
      });

      setNewRowData({ platform: '', username: '', followerCount: '', weekStartDate: '' });
      await fetchFollowerStats();

    } catch (error) {
      console.error('Error adding follower data:', error);
      toast({
        title: t('common.error'),
        description: "Erro ao adicionar dados de seguidores",
        variant: "destructive",
      });
    }
  };

  const handleEditRow = async (statId: string) => {
    const editData = editingRows[statId];
    if (!editData || !editData.platform || !editData.username || !editData.followerCount || !editData.weekStartDate) {
      toast({
        title: t('common.error'),
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('follower_stats')
        .update({
          platform: editData.platform,
          username: editData.username.startsWith('@') ? editData.username : `@${editData.username}`,
          follower_count: parseInt(editData.followerCount),
          week_start_date: editData.weekStartDate,
        })
        .eq('id', statId);

      if (error) {
        throw error;
      }

      toast({
        title: t('common.success'),
        description: "Dados de seguidores atualizados com sucesso!",
      });

      // Remove from editing state
      setEditingRows(prev => {
        const newState = { ...prev };
        delete newState[statId];
        return newState;
      });
      
      await fetchFollowerStats();

    } catch (error) {
      console.error('Error updating follower data:', error);
      toast({
        title: t('common.error'),
        description: "Erro ao atualizar dados de seguidores",
        variant: "destructive",
      });
    }
  };

  const startEditingRow = (stat: any) => {
    setEditingRows(prev => ({
      ...prev,
      [stat.id]: {
        platform: stat.platform,
        username: stat.username,
        followerCount: stat.follower_count.toString(),
        weekStartDate: stat.week_start_date
      }
    }));
  };

  const cancelEditingRow = (statId: string) => {
    setEditingRows(prev => {
      const newState = { ...prev };
      delete newState[statId];
      return newState;
    });
  };

  const updateEditingRow = (statId: string, field: string, value: string) => {
    setEditingRows(prev => ({
      ...prev,
      [statId]: {
        ...prev[statId],
        [field]: value
      }
    }));
  };

  const handleEditFollowerData = async () => {
    if (!editingFollowerStat || !formData.platform || !formData.username || !formData.followerCount || !formData.weekStartDate) {
      toast({
        title: t('common.error'),
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('follower_stats')
        .update({
          platform: formData.platform,
          username: formData.username.startsWith('@') ? formData.username : `@${formData.username}`,
          follower_count: parseInt(formData.followerCount),
          week_start_date: formData.weekStartDate,
        })
        .eq('id', editingFollowerStat.id);

      if (error) {
        throw error;
      }

      toast({
        title: t('common.success'),
        description: "Dados de seguidores editados com sucesso!",
      });

      setFormData({ platform: '', username: '', followerCount: '', weekStartDate: '' });
      setIsEditDialogOpen(false);
      setEditingFollowerStat(null);
      await fetchFollowerStats();

    } catch (error) {
      console.error('Error updating follower data:', error);
      toast({
        title: t('common.error'),
        description: "Erro ao editar dados de seguidores",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (stat: FollowerStats) => {
    setEditingFollowerStat(stat);
    setFormData({
      platform: stat.platform,
      username: stat.username,
      followerCount: stat.follower_count.toString(),
      weekStartDate: stat.week_start_date
    });
    setIsEditDialogOpen(true);
  };

  const exportData = () => {
    const exportData = {
      workspace: currentWorkspace?.name,
      generated_at: new Date().toISOString(),
      stats,
      platform_stats: platformStats,
      monthly_stats: monthlyStats,
      follower_stats: followerStats,
      weekly_follower_data: weeklyFollowerData
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${currentWorkspace?.name}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with export button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('analytics.title')}</h2>
        <Button onClick={exportData} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          {t('analytics.export')}
        </Button>
      </div>

      {/* Charts */}
      <Tabs defaultValue="platforms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="platforms">{t('analytics.platforms')}</TabsTrigger>
          <TabsTrigger value="followers">{t('analytics.followers')}</TabsTrigger>
          <TabsTrigger value="monthly">{t('analytics.monthly')}</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.platformDistribution')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={platformStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ platform, count, percent }) => 
                        `${platform}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {platformStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.platformStats')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {platformStats.map((platform, index) => (
                    <div key={platform.platform} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="font-medium">{platform.platform}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">{platform.count} posts</Badge>
                        <span className="text-sm text-muted-foreground">{platform.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="followers" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{t('analytics.weeklyGrowth')}</h3>
            <div className="flex gap-2">
              <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <History className="h-4 w-4 mr-2" />
                    {t('analytics.followerHistory')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle>{t('analytics.followerHistory')}</DialogTitle>
                    <div className="flex gap-2">
                       <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setIsEditMode(!isEditMode);
                          setShowNewRow(!isEditMode); // Automatically show new row when entering edit mode
                          if (isEditMode) {
                            // When exiting edit mode, reset all editing states
                            setNewRowData({ platform: '', username: '', followerCount: '', weekStartDate: '' });
                            setEditingRows({});
                          }
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        {isEditMode ? 'Salvar' : 'Editar'}
                      </Button>
                    </div>
                  </DialogHeader>
                  <div className="mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('analytics.platform')}</TableHead>
                          <TableHead>{t('analytics.username')}</TableHead>
                          <TableHead>{t('analytics.weekStartDate')}</TableHead>
                          <TableHead className="text-right">{t('analytics.followerCount')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isEditMode && (
                          <TableRow className="bg-muted/50">
                            <TableCell>
                              <Select value={newRowData.platform} onValueChange={(value) => setNewRowData({...newRowData, platform: value})}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Plataforma" />
                                </SelectTrigger>
                                <SelectContent>
                                  {platforms.map(platform => (
                                    <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={newRowData.username}
                                onChange={(e) => setNewRowData({...newRowData, username: e.target.value})}
                                placeholder="@username"
                                className="w-full"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={newRowData.weekStartDate}
                                onChange={(e) => setNewRowData({...newRowData, weekStartDate: e.target.value})}
                                className="w-full"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Input
                                  type="number"
                                  value={newRowData.followerCount}
                                  onChange={(e) => setNewRowData({...newRowData, followerCount: e.target.value})}
                                  placeholder="1000"
                                  className="w-20"
                                />
                                <Button size="sm" onClick={handleAddNewRow}>
                                  ✓
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => {
                                    setNewRowData({platform: '', username: '', followerCount: '', weekStartDate: ''});
                                  }}
                                >
                                  ✕
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {followerStats.length > 0 ? (
                          followerStats.slice().reverse().map((stat) => {
                            const isEditing = editingRows[stat.id];
                            
                            return (
                              <TableRow key={stat.id}>
                                <TableCell>
                                  {isEditing ? (
                                    <Select 
                                      value={isEditing.platform} 
                                      onValueChange={(value) => updateEditingRow(stat.id, 'platform', value)}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Plataforma" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {platforms.map(platform => (
                                          <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge>{stat.platform}</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isEditing ? (
                                    <Input
                                      value={isEditing.username}
                                      onChange={(e) => updateEditingRow(stat.id, 'username', e.target.value)}
                                      placeholder="@username"
                                      className="w-full"
                                    />
                                  ) : (
                                    <span className="font-medium">{stat.username}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isEditing ? (
                                    <Input
                                      type="date"
                                      value={isEditing.weekStartDate}
                                      onChange={(e) => updateEditingRow(stat.id, 'weekStartDate', e.target.value)}
                                      className="w-full"
                                    />
                                  ) : (
                                    formatDate(stat.week_start_date, (profile as any)?.date_format || 'DD/MM/YYYY', i18n.language)
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? (
                                    <div className="flex gap-1 justify-end">
                                      <Input
                                        type="number"
                                        value={isEditing.followerCount}
                                        onChange={(e) => updateEditingRow(stat.id, 'followerCount', e.target.value)}
                                        placeholder="1000"
                                        className="w-20"
                                      />
                                      <Button size="sm" onClick={() => handleEditRow(stat.id)}>
                                        ✓
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={() => cancelEditingRow(stat.id)}
                                      >
                                        ✕
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="font-bold text-primary">
                                        {stat.follower_count.toLocaleString()}
                                      </span>
                                      {isEditMode && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => startEditingRow(stat)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          !isEditMode && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                {t('analytics.noFollowerData')}
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                {t('analytics.weeklyGrowth')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyFollowerData.length > 0 && getActivePlatforms().length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyFollowerData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    {getActivePlatforms().map((platform, index) => (
                      <Line 
                        key={platform}
                        type="monotone" 
                        dataKey={platform} 
                        stroke={COLORS[index % COLORS.length]} 
                        name={platform}
                        connectNulls={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {followerStats.length === 0 
                    ? t('analytics.noFollowerData')
                    : "Adicione pelo menos 2 registros de diferentes datas para visualizar o gráfico"
                  }
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.monthlyTrend')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="posts" stroke="#8884d8" name="Total Posts" />
                  <Line type="monotone" dataKey="approved" stroke="#82ca9d" name="Approved Posts" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PostAnalytics;