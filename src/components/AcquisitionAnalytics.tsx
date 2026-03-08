import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Search, Users, CreditCard, TrendingUp, Award, UserCheck, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { ConversionFunnelAnalytics } from './ConversionFunnelAnalytics';
import { useToast } from '@/hooks/use-toast';

interface AcquisitionStats {
  source: string;
  total_users: number;
  free_users: number;
  paid_users: number;
  conversion_rate: number;
}

interface UserWithAcquisition {
  id: string;
  email: string;
  username: string | null;
  plan_tier: string;
  acquisition_source: string | null;
  acquisition_medium: string | null;
  acquisition_campaign: string | null;
  utm_id: string | null;
  referrer_url: string | null;
  created_at: string;
  subscription_status: string | null;
}

export function AcquisitionAnalytics() {
  const [stats, setStats] = useState<AcquisitionStats[]>([]);
  const [users, setUsers] = useState<UserWithAcquisition[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithAcquisition[]>([]);
  const [loading, setLoading] = useState(false); // Changed to false to prevent initial loading flash
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState<string>('30');
  const { toast } = useToast();

  const fetchAcquisitionData = async () => {
    try {
      // Only show loading if this is a refresh action, not initial load
      if (isInitialized) {
        setLoading(true);
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(timeRange));

      // Fetch active users with acquisition data
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          username,
          plan_tier,
          acquisition_source,
          acquisition_medium,
          acquisition_campaign,
          utm_id,
          referrer_url,
          created_at,
          subscription_status
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      // Also fetch deleted users data for analytics (without personal info)
      const { data: deletedUsersData, error: deletedError } = await supabase
        .from('deleted_users')
        .select(`
          id,
          plan_tier,
          acquisition_source,
          acquisition_medium,
          acquisition_campaign,
          created_at,
          was_paying_user
        `)
        .gte('created_at', startDate.toISOString());

      if (usersError) throw usersError;
      if (deletedError) {
        console.warn('Error fetching deleted users data:', deletedError);
      }

      const usersWithAcquisition = usersData as UserWithAcquisition[];
      setUsers(usersWithAcquisition);

      // Calculate stats by source including deleted users
      const sourceStats = usersWithAcquisition.reduce((acc, user) => {
        const source = user.acquisition_source || 'unknown';
        if (!acc[source]) {
          acc[source] = { total: 0, free: 0, paid: 0 };
        }
        acc[source].total++;
        if (user.plan_tier === 'free') {
          acc[source].free++;
        } else {
          acc[source].paid++;
        }
        return acc;
      }, {} as Record<string, { total: number; free: number; paid: number }>);

      // Add deleted users to stats (they contribute to total and conversion metrics)
      if (deletedUsersData) {
        deletedUsersData.forEach((deletedUser: any) => {
          const source = deletedUser.acquisition_source || 'unknown';
          if (!sourceStats[source]) {
            sourceStats[source] = { total: 0, free: 0, paid: 0 };
          }
          sourceStats[source].total++;
          if (deletedUser.was_paying_user) {
            sourceStats[source].paid++;
          } else {
            sourceStats[source].free++;
          }
        });
      }

      const formattedStats: AcquisitionStats[] = Object.entries(sourceStats).map(([source, data]) => ({
        source,
        total_users: data.total,
        free_users: data.free,
        paid_users: data.paid,
        conversion_rate: data.total > 0 ? (data.paid / data.total) * 100 : 0,
      })).sort((a, b) => b.total_users - a.total_users);

      setStats(formattedStats);
    } catch (error) {
      console.error('Error fetching acquisition data:', error);
      toast({
        title: "Error",
        description: "Failed to load acquisition data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    fetchAcquisitionData();
  }, [timeRange]);

  useEffect(() => {
    let filtered = users;

    if (selectedSource !== 'all') {
      filtered = filtered.filter(user => 
        (user.acquisition_source || 'unknown') === selectedSource
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredUsers(filtered);
  }, [users, selectedSource, searchTerm]);

  const getSourceBadgeVariant = (source: string) => {
    switch (source) {
      case 'google':
      case 'search_engine':
        return 'default';
      case 'social_media':
      case 'facebook':
      case 'instagram':
      case 'linkedin':
      case 'twitter':
        return 'secondary';
      case 'product_hunt':
        return 'destructive';
      case 'lovable':
        return 'outline';
      case 'discord':
        return 'secondary';
      case 'direct':
        return 'default';
      default:
        return 'outline';
    }
  };

  const formatSourceName = (source: string) => {
    return source.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };


  // Show loading state only when refreshing data, not on initial load
  if (loading && isInitialized) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalUsers = stats.reduce((sum, stat) => sum + stat.total_users, 0);
  const activeUsers = users.length; // Only existing users from profiles table
  const totalPaidUsersHistoric = stats.reduce((sum, stat) => sum + stat.paid_users, 0);
  const activePaidUsers = users.filter(user => user.plan_tier !== 'free').length;
  const overallConversion = totalUsers > 0 ? (totalPaidUsersHistoric / totalUsers) * 100 : 0;

  // Group active paid users by plan tier
  const activePaidUsersByTier = users
    .filter(user => user.plan_tier !== 'free')
    .reduce((acc, user) => {
      acc[user.plan_tier] = (acc[user.plan_tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="acquisition" className="space-y-6">
        <TabsList>
          <TabsTrigger value="acquisition">User Acquisition</TabsTrigger>
          <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
        </TabsList>
        
        <TabsContent value="acquisition" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Acquired</p>
                <p className="text-2xl font-bold">{totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{activeUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Paid Users</p>
                  <p className="text-2xl font-bold">{activePaidUsers}</p>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm">Paid Users Breakdown</h4>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Total Historical</span>
                          <span className="font-medium">{totalPaidUsersHistoric}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Active Current</span>
                          <span className="font-medium">{activePaidUsers}</span>
                        </div>
                        
                        {Object.keys(activePaidUsersByTier).length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-sm font-medium mb-2">Active by Plan Tier:</p>
                            <div className="space-y-1">
                              {Object.entries(activePaidUsersByTier).map(([tier, count]) => (
                                <div key={tier} className="flex justify-between items-center">
                                  <span className="text-sm text-muted-foreground capitalize">{tier}</span>
                                  <span className="text-sm font-medium">{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{overallConversion.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Top Source</p>
                <p className="text-2xl font-bold">
                  {stats[0] ? formatSourceName(stats[0].source) : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Time Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          onClick={fetchAcquisitionData}
          variant="outline"
          className="w-full sm:w-auto"
        >
          Refresh Data
        </Button>
      </div>


      {/* User Details */}
      <Card>
        <CardHeader>
          <CardTitle>User Details</CardTitle>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {stats.map((stat) => (
                  <SelectItem key={stat.source} value={stat.source}>
                    {formatSourceName(stat.source)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search by email or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-[300px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Medium</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.slice(0, 100).map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.username || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.plan_tier === 'free' ? 'secondary' : 'default'}>
                      {user.plan_tier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSourceBadgeVariant(user.acquisition_source || 'unknown')}>
                      {formatSourceName(user.acquisition_source || 'unknown')}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.acquisition_medium || '-'}</TableCell>
                  <TableCell>{user.acquisition_campaign || '-'}</TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredUsers.length > 100 && (
            <p className="text-sm text-muted-foreground mt-4">
              Showing first 100 results. Use filters to narrow down the results.
            </p>
          )}
          </CardContent>
        </Card>
        </TabsContent>
        
        <TabsContent value="funnel">
          <ConversionFunnelAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}