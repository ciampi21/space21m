import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/dateUtils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';

interface FollowerStats {
  id: string;
  platform: string;
  username: string;
  follower_count: number;
  week_start_date: string;
  workspace_id: string;
  workspace_name?: string;
}

interface WeeklyGrowthData {
  week: string;
  weekNumber: number;
  [workspaceKey: string]: string | number; // Dynamic workspace keys for growth percentages
}

const GeneralPostAnalytics: React.FC = () => {
  const [followerStats, setFollowerStats] = useState<FollowerStats[]>([]);
  const [weeklyGrowthData, setWeeklyGrowthData] = useState<WeeklyGrowthData[]>([]);
  const [workspaces, setWorkspaces] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  const { profile, user } = useAuth();
  const { t, i18n } = useTranslation();

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#ff6b6b', '#4ecdc4'];

  useEffect(() => {
    if (user?.id) {
      fetchAllFollowerStats();
    }
  }, [user?.id]);

  const fetchAllFollowerStats = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // First, get all workspaces the user belongs to
      const { data: userWorkspaces, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id, name')
        .or(`owner_id.eq.${user.id},id.in.(${await getUserWorkspaceMemberships()})`);

      if (workspacesError) {
        console.error('Error fetching workspaces:', workspacesError);
        return;
      }

      // Create workspace name mapping
      const workspaceMap: {[key: string]: string} = {};
      userWorkspaces?.forEach(ws => {
        workspaceMap[ws.id] = ws.name;
      });
      setWorkspaces(workspaceMap);

      // Fetch follower stats for all user's workspaces
      const workspaceIds = userWorkspaces?.map(ws => ws.id) || [];
      if (workspaceIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: followers, error } = await supabase
        .from('follower_stats')
        .select('*')
        .in('workspace_id', workspaceIds)
        .order('week_start_date', { ascending: true });

      if (error) {
        console.error('Error fetching follower stats:', error);
        return;
      }

      // Add workspace names to follower stats
      const followersWithWorkspace = followers?.map(stat => ({
        ...stat,
        workspace_name: workspaceMap[stat.workspace_id]
      })) || [];

      setFollowerStats(followersWithWorkspace);

      // Process data for weekly growth chart
      processWeeklyGrowthData(followersWithWorkspace, workspaceMap);

    } catch (error) {
      console.error('Error in fetchAllFollowerStats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserWorkspaceMemberships = async (): Promise<string> => {
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user?.id);
    
    return memberships?.map(m => m.workspace_id).join(',') || '';
  };

  const processWeeklyGrowthData = (followers: FollowerStats[], workspaceMap: {[key: string]: string}) => {
    // Group by workspace and platform combination, then sort by date
    const workspacePlatformData: {[key: string]: FollowerStats[]} = {};
    
    followers.forEach(stat => {
      const key = `${stat.workspace_id}_${stat.platform}`;
      if (!workspacePlatformData[key]) {
        workspacePlatformData[key] = [];
      }
      workspacePlatformData[key].push(stat);
    });

    // Sort each group by date
    Object.keys(workspacePlatformData).forEach(key => {
      workspacePlatformData[key].sort((a, b) => 
        new Date(a.week_start_date).getTime() - new Date(b.week_start_date).getTime()
      );
    });

    // Get all unique weeks and convert to week numbers
    const allWeeks = new Set<string>();
    followers.forEach(stat => {
      allWeeks.add(stat.week_start_date);
    });
    
    const sortedWeeks = Array.from(allWeeks).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    // Create weekly growth data
    const growthData: WeeklyGrowthData[] = [];
    
    sortedWeeks.forEach((week, weekIndex) => {
      const weekData: WeeklyGrowthData = {
        week: t('analytics.week', 'Week') + ` ${weekIndex + 1}`,
        weekNumber: weekIndex + 1
      };

      // Calculate growth for each workspace-platform combination
      Object.entries(workspacePlatformData).forEach(([key, stats]) => {
        const [workspaceId, platform] = key.split('_');
        const workspaceName = workspaceMap[workspaceId];
        const displayKey = `${workspaceName} (${platform})`;

        // Find current week data
        const currentStat = stats.find(s => s.week_start_date === week);
        if (!currentStat) return;

        // Find previous week data for growth calculation
        const currentIndex = stats.findIndex(s => s.week_start_date === week);
        if (currentIndex > 0) {
          const previousStat = stats[currentIndex - 1];
          const growth = ((currentStat.follower_count - previousStat.follower_count) / previousStat.follower_count) * 100;
          weekData[displayKey] = Math.round(growth * 100) / 100; // Round to 2 decimal places
        } else {
          // First week, no growth data
          weekData[displayKey] = 0;
        }
      });

      growthData.push(weekData);
    });

    setWeeklyGrowthData(growthData);
  };

  // Get workspace-platform combinations for the chart lines
  const getWorkspacePlatformKeys = () => {
    const keys = new Set<string>();
    weeklyGrowthData.forEach(data => {
      Object.keys(data).forEach(key => {
        if (key !== 'week' && key !== 'weekNumber') {
          keys.add(key);
        }
      });
    });
    return Array.from(keys);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey}: {entry.value}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="elegant-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('analytics.followerGrowth', 'Follower Growth')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weeklyGrowthData.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={weeklyGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    label={{ value: t('analytics.growthPercentage', 'Growth (%)'), angle: -90, position: 'insideLeft' }}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {getWorkspacePlatformKeys().map((key, index) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              
              <div className="text-sm text-muted-foreground">
                <p>
                  • {t('analytics.xAxisDescription', 'X-axis: Week number (based on chronological order of data)')}
                </p>
                <p>
                  • {t('analytics.yAxisDescription', 'Y-axis: Growth percentage compared to previous week')}
                </p>
                <p>
                  • {t('analytics.lineDescription', 'Each line represents a specific workspace and platform')}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {t('analytics.noFollowerDataFound', 'No follower data found for your workspaces.')}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {t('analytics.addFollowerDataInstruction', 'Add follower data to individual workspaces to see the growth chart.')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GeneralPostAnalytics;