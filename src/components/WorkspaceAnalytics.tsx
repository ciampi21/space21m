import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, Download, Plus, Trash2, Edit3 } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface PostStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  scheduled: number;
  published: number;
}

interface PlatformStats {
  platform: string;
  total: number;
  approved: number;
  published: number;
}

interface PostTypeStats {
  type: string;
  total: number;
  approved: number;
  published: number;
}

interface MonthlyStats {
  month: string;
  total: number;
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
  [platform: string]: number | string;
}

interface WorkspaceAnalyticsProps {
  workspaceId: string;
}

const WorkspaceAnalytics: React.FC<WorkspaceAnalyticsProps> = ({ workspaceId }) => {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  
  const [stats, setStats] = useState<PostStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    scheduled: 0,
    published: 0
  });
  
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([]);
  const [postTypeStats, setPostTypeStats] = useState<PostTypeStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [followerStats, setFollowerStats] = useState<FollowerStats[]>([]);
  const [weeklyFollowerData, setWeeklyFollowerData] = useState<WeeklyFollowerData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add follower data state
  const [addFollowerOpen, setAddFollowerOpen] = useState(false);
  const [newFollowerData, setNewFollowerData] = useState({
    platform: '',
    username: '',
    follower_count: '',
    week_start_date: ''
  });

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

  // Calculate dynamic Y-axis domain and ticks for follower chart
  const getFollowerChartDomain = () => {
    if (weeklyFollowerData.length === 0) return ['auto', 'auto'];
    
    let allValues: number[] = [];
    weeklyFollowerData.forEach(data => {
      getActivePlatforms().forEach(platform => {
        if (typeof data[platform] === 'number') {
          allValues.push(data[platform] as number);
        }
      });
    });
    
    if (allValues.length === 0) return ['auto', 'auto'];
    
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;
    
    // Add 15% margin above and below, but ensure min is not less than 0
    const margin = range * 0.15;
    const chartMin = Math.max(0, Math.floor(minValue - margin));
    const chartMax = Math.ceil(maxValue + margin);
    
    return [chartMin, chartMax];
  };

  // Generate rounded tick values for Y-axis
  const getFollowerChartTicks = () => {
    if (weeklyFollowerData.length === 0) return undefined;
    
    let allValues: number[] = [];
    weeklyFollowerData.forEach(data => {
      getActivePlatforms().forEach(platform => {
        if (typeof data[platform] === 'number') {
          allValues.push(data[platform] as number);
        }
      });
    });
    
    if (allValues.length === 0) return undefined;
    
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;
    
    // Add 15% margin above and below
    const margin = range * 0.15;
    const chartMin = Math.max(0, Math.floor(minValue - margin));
    const chartMax = Math.ceil(maxValue + margin);
    const totalRange = chartMax - chartMin;
    
    // Determine appropriate step size (25, 50, 100, etc.)
    let step = 50;
    if (totalRange > 1000) step = 100;
    else if (totalRange > 2000) step = 200;
    else if (totalRange > 5000) step = 500;
    else if (totalRange < 200) step = 25;
    
    // Generate rounded ticks
    const ticks = [];
    const roundedMin = Math.floor(chartMin / step) * step;
    const roundedMax = Math.ceil(chartMax / step) * step;
    
    for (let i = roundedMin; i <= roundedMax; i += step) {
      ticks.push(i);
    }
    
    return ticks;
  };

  // Custom tooltip for Pie Chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const { platform, total } = data.payload;
      const totalPosts = platformStats.reduce((sum, p) => sum + p.total, 0);
      const percentage = ((total / totalPosts) * 100).toFixed(1);
      
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
              Posts: <span className="font-semibold text-foreground">{total}</span>
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
    if (workspaceId) {
      fetchAnalytics();
      fetchFollowerStats();
    }
  }, [workspaceId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch posts data for this workspace only
      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (error) throw error;

      if (posts) {
        // Calculate general stats
        const generalStats = {
          total: posts.length,
          pending: posts.filter(p => p.status === 'Pendente').length,
          approved: posts.filter(p => p.status === 'Aprovado').length,
          rejected: posts.filter(p => p.status === 'Reprovado' || p.status === 'Erro').length,
          scheduled: posts.filter(p => p.status === 'Programado').length,
          published: posts.filter(p => p.status === 'Postado').length,
        };
        setStats(generalStats);

        // Calculate platform stats
        const platformData: Record<string, { total: number; approved: number; published: number }> = {};
        posts.forEach(post => {
          post.platforms?.forEach((platform: string) => {
            if (!platformData[platform]) {
              platformData[platform] = { total: 0, approved: 0, published: 0 };
            }
            platformData[platform].total++;
            if (post.status === 'Aprovado') platformData[platform].approved++;
            if (post.status === 'Postado') platformData[platform].published++;
          });
        });
        
        const platformStatsArray = Object.entries(platformData).map(([platform, data]) => ({
          platform,
          ...data
        }));
        setPlatformStats(platformStatsArray);

        // Calculate post type stats
        const typeData: Record<string, { total: number; approved: number; published: number }> = {};
        posts.forEach(post => {
          const type = post.post_type || 'Unknown';
          if (!typeData[type]) {
            typeData[type] = { total: 0, approved: 0, published: 0 };
          }
          typeData[type].total++;
          if (post.status === 'Aprovado') typeData[type].approved++;
          if (post.status === 'Postado') typeData[type].published++;
        });
        
        const typeStatsArray = Object.entries(typeData).map(([type, data]) => ({
          type,
          ...data
        }));
        setPostTypeStats(typeStatsArray);

        // Calculate monthly stats using published_at date
        const monthlyData: Record<string, { total: number; approved: number }> = {};
        posts.filter(post => post.published_at).forEach(post => {
          const date = new Date(post.published_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { total: 0, approved: 0 };
          }
          monthlyData[monthKey].total++;
          if (post.status === 'Aprovado') monthlyData[monthKey].approved++;
        });
        
        const monthlyStatsArray = Object.entries(monthlyData)
          .map(([month, data]) => ({
            month,
            ...data
          }))
          .sort((a, b) => a.month.localeCompare(b.month));
        setMonthlyStats(monthlyStatsArray);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error(t('analytics.errorAddingData'));
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowerStats = async () => {
    try {
      const { data: followers, error } = await supabase
        .from('follower_stats')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('week_start_date', { ascending: true });

      if (error) throw error;

      setFollowerStats(followers || []);

      // Process data for weekly chart - only include platforms with actual data
      const weeklyData: Record<string, WeeklyFollowerData> = {};
      const platformsWithData = new Set<string>();
      
      followers?.forEach(stat => {
        const weekKey = format(new Date(stat.week_start_date), 'd/M/yy');
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { week: weekKey };
        }
        
        weeklyData[weekKey][stat.platform] = stat.follower_count;
        platformsWithData.add(stat.platform);
      });

      // Convert to array and ensure data consistency
      const chartData = Object.values(weeklyData);
      
      console.log('Workspace follower chart data:', {
        workspaceId,
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
    if (!newFollowerData.platform || !newFollowerData.username || !newFollowerData.follower_count || !newFollowerData.week_start_date) {
      toast.error('Todos os campos são obrigatórios');
      return;
    }

    try {
      const { error } = await supabase
        .from('follower_stats')
        .insert({
          workspace_id: workspaceId,
          platform: newFollowerData.platform,
          username: newFollowerData.username,
          follower_count: parseInt(newFollowerData.follower_count),
          week_start_date: newFollowerData.week_start_date,
          created_by: profile?.user_id
        });

      if (error) throw error;

      toast.success(t('analytics.followerDataAdded'));
      setAddFollowerOpen(false);
      setNewFollowerData({
        platform: '',
        username: '',
        follower_count: '',
        week_start_date: ''
      });
      fetchFollowerStats();
    } catch (error) {
      console.error('Error adding follower data:', error);
      toast.error(t('analytics.errorAddingData'));
    }
  };

  const exportData = () => {
    const data = {
      workspace_id: workspaceId,
      generated_at: new Date().toISOString(),
      stats,
      platformStats,
      postTypeStats,
      monthlyStats,
      followerStats,
      weeklyFollowerData
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-analytics-${workspaceId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t('analytics.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('analytics.description')}</p>
        </div>
        <Button onClick={exportData} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          {t('analytics.export')}
        </Button>
      </div>


      {/* Analytics Tabs */}
      <Tabs defaultValue="platforms" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="platforms">{t('analytics.platforms')}</TabsTrigger>
          <TabsTrigger value="followers">{t('analytics.followers')}</TabsTrigger>
          <TabsTrigger value="monthly">{t('analytics.monthly')}</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="space-y-6">
          {/* Platform Distribution Chart */}
          <Card className="elegant-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('analytics.platformDistribution')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {platformStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={platformStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ platform, total, percent }) => 
                        `${platform}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {platformStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('analytics.noPlatformData')}
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Platform Stats Table */}
          <Card className="elegant-card">
            <CardHeader>
              <CardTitle>{t('analytics.platformStats')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {platformStats.map((platform, index) => (
                  <div key={platform.platform} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium">{platform.platform}</span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <Badge variant="outline">{t('analytics.total')}: {platform.total}</Badge>
                      <Badge variant="secondary">{t('analytics.approved')}: {platform.approved}</Badge>
                      <Badge variant="default">{t('analytics.published')}: {platform.published}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followers" className="space-y-6">
          {/* Weekly Growth Chart */}
          <Card className="elegant-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('analytics.weeklyGrowth')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyFollowerData.length > 0 && getActivePlatforms().length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyFollowerData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" interval="preserveStartEnd" />
                    <YAxis domain={getFollowerChartDomain()} ticks={getFollowerChartTicks()} />
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
                      : t('analytics.needMoreFollowerData')
                    }
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Follower History Table */}
          <Card className="elegant-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('analytics.followerHistory')}</CardTitle>
              <Dialog open={addFollowerOpen} onOpenChange={setAddFollowerOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('analytics.addFollowerData')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('analytics.addFollowerData')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="platform">{t('analytics.platform')}</Label>
                      <Select onValueChange={(value) => setNewFollowerData(prev => ({ ...prev, platform: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a plataforma" />
                        </SelectTrigger>
                        <SelectContent>
                          {platforms.map(platform => (
                            <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="username">{t('analytics.username')}</Label>
                      <Input
                        id="username"
                        value={newFollowerData.username}
                        onChange={(e) => setNewFollowerData(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="@usuario"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="follower_count">{t('analytics.followerCount')}</Label>
                      <Input
                        id="follower_count"
                        type="number"
                        value={newFollowerData.follower_count}
                        onChange={(e) => setNewFollowerData(prev => ({ ...prev, follower_count: e.target.value }))}
                        placeholder="1000"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="week_start_date">{t('analytics.weekStartDate')}</Label>
                      <Input
                        id="week_start_date"
                        type="date"
                        value={newFollowerData.week_start_date}
                        onChange={(e) => setNewFollowerData(prev => ({ ...prev, week_start_date: e.target.value }))}
                      />
                    </div>
                    
                    <Button onClick={handleAddNewRow} className="w-full">
                      {t('analytics.addData')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {followerStats.length > 0 ? (
                <div className="space-y-2">
                  {followerStats.map((stat) => (
                    <div key={stat.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{stat.platform}</Badge>
                        <span className="font-medium">{stat.username}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {stat.follower_count.toLocaleString()} seguidores
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(stat.week_start_date), 'd/M/yy')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t('analytics.noFollowerData')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          {/* Monthly Trend Chart */}
          <Card className="elegant-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('analytics.monthlyTrend')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#8884d8" name={t('analytics.total')} />
                    <Line type="monotone" dataKey="approved" stroke="#82ca9d" name={t('analytics.approved')} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t('analytics.noMonthlyData')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkspaceAnalytics;