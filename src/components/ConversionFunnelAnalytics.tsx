import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Eye, UserPlus, CheckCircle, TrendingUp, Gift } from 'lucide-react';

interface FunnelData {
  source: string;
  campaign?: string; // Optional campaign field for drill-down
  utm_id?: string; // Optional utm_id for deepest drill-down
  page_views: number;
  signup_started: number;
  signup_completed: number;
  ctr: number; // Click to start signup rate
  completion_rate: number; // Signup completion rate
  conversion_rate: number; // Overall conversion rate
}

interface TimeSeriesData {
  date: string;
  page_views: number;
  signup_started: number;
  signup_completed: number;
}

export function ConversionFunnelAnalytics() {
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(false); // Changed to false to prevent initial loading flash
  const [isInitialized, setIsInitialized] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [activeTab, setActiveTab] = useState<'funnel' | 'trends'>('funnel');
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [campaignData, setCampaignData] = useState<Record<string, FunnelData[]>>({});
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [utmIdData, setUtmIdData] = useState<Record<string, FunnelData[]>>({});

  const fetchFunnelData = async () => {
    // Only show loading if this is a refresh action, not initial load
    if (isInitialized) {
      setLoading(true);
    }
    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Fetch all acquisition events in the time range
      const { data: events, error } = await supabase
        .from('user_acquisition_events')
        .select('source, event_type, created_at, session_id, utm_source, utm_medium, utm_campaign, page_url, referrer_url')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter acquisition events to exclude system internal events
      const acquisitionEvents = events?.filter(event => {
        // Exclude events from email confirmations and system internal pages
        if (event.page_url && (
          event.page_url.includes('token_hash') ||
          event.page_url.includes('type=signup') ||
          event.page_url.includes('type=email_confirmation')
        )) {
          return false;
        }
        
        // Exclude events from webmail referrers
        if (event.referrer_url && (
          event.referrer_url.includes('gmail.com') ||
          event.referrer_url.includes('outlook.com') ||
          event.referrer_url.includes('hostgator.com') ||
          event.referrer_url.includes('webmail')
        )) {
          return false;
        }
        
        // Include all valid acquisition events
        return event.event_type === 'page_view' ||
               event.event_type === 'landing_page_view' || 
               event.event_type === 'signup_started' ||
               event.event_type === 'signup_completed' ||
               event.event_type === 'signup';
      });

      const sourceGroups = acquisitionEvents?.reduce((acc, event) => {
        const source = event.source || 'direct';
        if (!acc[source]) {
          acc[source] = { page_views: 0, signup_started: 0, signup_completed: 0 };
        }
        
        if (event.event_type === 'page_view' || event.event_type === 'landing_page_view') {
          acc[source].page_views++;
        } else if (event.event_type === 'signup_started') {
          acc[source].signup_started++;
        } else if (event.event_type === 'signup_completed' || event.event_type === 'signup') {
          acc[source].signup_completed++;
        }
        
        return acc;
      }, {} as Record<string, { page_views: number; signup_started: number; signup_completed: number }>);

      // Calculate rates
      const funnelMetrics: FunnelData[] = Object.entries(sourceGroups || {}).map(([source, data]) => ({
        source,
        page_views: data.page_views,
        signup_started: data.signup_started,
        signup_completed: data.signup_completed,
        ctr: data.page_views > 0 ? (data.signup_started / data.page_views) * 100 : 0,
        completion_rate: data.signup_started > 0 ? (data.signup_completed / data.signup_started) * 100 : 0,
        conversion_rate: data.page_views > 0 ? (data.signup_completed / data.page_views) * 100 : 0,
      }));

      // Sort by conversion rate
      funnelMetrics.sort((a, b) => b.conversion_rate - a.conversion_rate);
      setFunnelData(funnelMetrics);

      // Fetch time series data (daily aggregation) for acquisition events only
      const timeSeriesGroups = acquisitionEvents?.reduce((acc, event) => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { page_views: 0, signup_started: 0, signup_completed: 0 };
        }
        
        if (event.event_type === 'page_view' || event.event_type === 'landing_page_view') {
          acc[date].page_views++;
        } else if (event.event_type === 'signup_started') {
          acc[date].signup_started++;
        } else if (event.event_type === 'signup_completed' || event.event_type === 'signup') {
          acc[date].signup_completed++;
        }
        
        return acc;
      }, {} as Record<string, { page_views: number; signup_started: number; signup_completed: number }>);

      // Generate all dates in the range to fill gaps with zeros
      const allDates: TimeSeriesData[] = [];
      const currentDate = new Date(startDate);
      const today = new Date();
      
      while (currentDate <= today) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const existingData = timeSeriesGroups?.[dateStr];
        
        allDates.push({
          date: dateStr,
          page_views: existingData?.page_views || 0,
          signup_started: existingData?.signup_started || 0,
          signup_completed: existingData?.signup_completed || 0,
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      setTimeSeriesData(allDates);

    } catch (error) {
      console.error('Error fetching funnel data:', error);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    fetchFunnelData();
  }, [timeRange]);

  const fetchCampaignData = async (source: string) => {
    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Fetch events for the specific source
      const { data: events, error } = await supabase
        .from('user_acquisition_events')
        .select('source, event_type, utm_campaign, created_at, page_url, referrer_url')
        .eq('source', source)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter acquisition events (same logic as fetchFunnelData)
      const acquisitionEvents = events?.filter(event => {
        if (event.page_url && (
          event.page_url.includes('token_hash') ||
          event.page_url.includes('type=signup') ||
          event.page_url.includes('type=email_confirmation')
        )) {
          return false;
        }
        
        if (event.referrer_url && (
          event.referrer_url.includes('gmail.com') ||
          event.referrer_url.includes('outlook.com') ||
          event.referrer_url.includes('hostgator.com') ||
          event.referrer_url.includes('webmail')
        )) {
          return false;
        }
        
        return event.event_type === 'page_view' ||
               event.event_type === 'landing_page_view' || 
               event.event_type === 'signup_started' ||
               event.event_type === 'signup_completed' ||
               event.event_type === 'signup';
      });

      // Group by campaign
      const campaignGroups = acquisitionEvents?.reduce((acc, event) => {
        const campaign = event.utm_campaign || 'Unknown';
        if (!acc[campaign]) {
          acc[campaign] = { page_views: 0, signup_started: 0, signup_completed: 0 };
        }
        
        if (event.event_type === 'page_view' || event.event_type === 'landing_page_view') {
          acc[campaign].page_views++;
        } else if (event.event_type === 'signup_started') {
          acc[campaign].signup_started++;
        } else if (event.event_type === 'signup_completed' || event.event_type === 'signup') {
          acc[campaign].signup_completed++;
        }
        
        return acc;
      }, {} as Record<string, { page_views: number; signup_started: number; signup_completed: number }>);

      // Calculate metrics by campaign
      const campaignMetrics: FunnelData[] = Object.entries(campaignGroups || {}).map(([campaign, data]) => ({
        source,
        campaign,
        page_views: data.page_views,
        signup_started: data.signup_started,
        signup_completed: data.signup_completed,
        ctr: data.page_views > 0 ? (data.signup_started / data.page_views) * 100 : 0,
        completion_rate: data.signup_started > 0 ? (data.signup_completed / data.signup_started) * 100 : 0,
        conversion_rate: data.page_views > 0 ? (data.signup_completed / data.page_views) * 100 : 0,
      }));

      // Sort by conversion rate
      campaignMetrics.sort((a, b) => b.conversion_rate - a.conversion_rate);

      // Update state
      setCampaignData(prev => ({
        ...prev,
        [source]: campaignMetrics
      }));

    } catch (error) {
      console.error('Error fetching campaign data:', error);
    }
  };

  const fetchUtmIdData = async (source: string, campaign: string) => {
    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Fetch events for the specific source and campaign
      const { data: events, error } = await supabase
        .from('user_acquisition_events')
        .select('source, event_type, utm_campaign, utm_id, created_at, page_url, referrer_url')
        .eq('source', source)
        .eq('utm_campaign', campaign)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter acquisition events
      const acquisitionEvents = events?.filter(event => {
        if (event.page_url && (
          event.page_url.includes('token_hash') ||
          event.page_url.includes('type=signup') ||
          event.page_url.includes('type=email_confirmation')
        )) {
          return false;
        }
        
        if (event.referrer_url && (
          event.referrer_url.includes('gmail.com') ||
          event.referrer_url.includes('outlook.com') ||
          event.referrer_url.includes('hostgator.com') ||
          event.referrer_url.includes('webmail')
        )) {
          return false;
        }
        
        return event.event_type === 'page_view' ||
               event.event_type === 'landing_page_view' || 
               event.event_type === 'signup_started' ||
               event.event_type === 'signup_completed' ||
               event.event_type === 'signup';
      });

      // Group by utm_id
      const utmIdGroups = acquisitionEvents?.reduce((acc, event) => {
        const utmId = event.utm_id || 'No UTM ID';
        if (!acc[utmId]) {
          acc[utmId] = { page_views: 0, signup_started: 0, signup_completed: 0 };
        }
        
        if (event.event_type === 'page_view' || event.event_type === 'landing_page_view') {
          acc[utmId].page_views++;
        } else if (event.event_type === 'signup_started') {
          acc[utmId].signup_started++;
        } else if (event.event_type === 'signup_completed' || event.event_type === 'signup') {
          acc[utmId].signup_completed++;
        }
        
        return acc;
      }, {} as Record<string, { page_views: number; signup_started: number; signup_completed: number }>);

      // Calculate metrics by utm_id
      const utmIdMetrics: FunnelData[] = Object.entries(utmIdGroups || {}).map(([utmId, data]) => ({
        source,
        campaign,
        utm_id: utmId,
        page_views: data.page_views,
        signup_started: data.signup_started,
        signup_completed: data.signup_completed,
        ctr: data.page_views > 0 ? (data.signup_started / data.page_views) * 100 : 0,
        completion_rate: data.signup_started > 0 ? (data.signup_completed / data.signup_started) * 100 : 0,
        conversion_rate: data.page_views > 0 ? (data.signup_completed / data.page_views) * 100 : 0,
      }));

      // Sort by conversion rate
      utmIdMetrics.sort((a, b) => b.conversion_rate - a.conversion_rate);

      // Update state
      const key = `${source}:${campaign}`;
      setUtmIdData(prev => ({
        ...prev,
        [key]: utmIdMetrics
      }));

    } catch (error) {
      console.error('Error fetching utm_id data:', error);
    }
  };

  const handleSourceClick = (source: string) => {
    if (expandedSource === source) {
      // Collapse if already expanded
      setExpandedSource(null);
    } else {
      // Expand and fetch data if not cached
      setExpandedSource(source);
      if (!campaignData[source]) {
        fetchCampaignData(source);
      }
    }
  };

  const handleCampaignClick = (source: string, campaign: string) => {
    const key = `${source}:${campaign}`;
    
    if (expandedCampaign === key) {
      // Collapse if already expanded
      setExpandedCampaign(null);
    } else {
      // Expand and fetch data if not cached
      setExpandedCampaign(key);
      if (!utmIdData[key]) {
        fetchUtmIdData(source, campaign);
      }
    }
  };

  // Helper para formatar nomes de fontes
  const formatSourceName = (source: string): string => {
    const sourceLabels: Record<string, string> = {
      'referral_offer': 'Referral Offer',
      'direct': 'Direct',
      'google': 'Google',
      'facebook': 'Facebook',
      'instagram': 'Instagram',
      'linkedin': 'LinkedIn',
      'twitter': 'Twitter / X',
      'product_hunt': 'Product Hunt',
      'lovable': 'Lovable',
      'discord': 'Discord',
      'email': 'Email',
      'referral': 'Referral (Other)',
      'yt': 'YouTube',
      '21mnotes': '21M Notes'
    };
    
    return sourceLabels[source] || source.charAt(0).toUpperCase() + source.slice(1);
  };

  const getSourceBadgeVariant = (rate: number) => {
    if (rate >= 5) return 'default';
    if (rate >= 2) return 'secondary';
    return 'outline';
  };

  const totalMetrics = funnelData.reduce(
    (acc, curr) => ({
      page_views: acc.page_views + curr.page_views,
      signup_started: acc.signup_started + curr.signup_started,
      signup_completed: acc.signup_completed + curr.signup_completed,
    }),
    { page_views: 0, signup_started: 0, signup_completed: 0 }
  );

  const overallCTR = totalMetrics.page_views > 0 ? (totalMetrics.signup_started / totalMetrics.page_views) * 100 : 0;
  const overallCompletion = totalMetrics.signup_started > 0 ? (totalMetrics.signup_completed / totalMetrics.signup_started) * 100 : 0;
  const overallConversion = totalMetrics.page_views > 0 ? (totalMetrics.signup_completed / totalMetrics.page_views) * 100 : 0;

  // Show loading state only when refreshing data, not on initial load
  if (loading && isInitialized) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel Analytics</CardTitle>
          <CardDescription>Loading funnel data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted/50 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Page Views</p>
                <p className="text-2xl font-bold">{totalMetrics.page_views.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">CTR</p>
                <p className="text-2xl font-bold">{overallCTR.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{overallCompletion.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{overallConversion.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conversion Funnel Analytics</CardTitle>
              <CardDescription>
                Track visitor behavior from page views to signup completion
              </CardDescription>
            </div>
            <Tabs value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
              <TabsList>
                <TabsTrigger value="7d">7 days</TabsTrigger>
                <TabsTrigger value="30d">30 days</TabsTrigger>
                <TabsTrigger value="90d">90 days</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'funnel' | 'trends')} className="space-y-4">
            <TabsList>
              <TabsTrigger value="funnel">Funnel by Source</TabsTrigger>
              <TabsTrigger value="trends">Time Trends</TabsTrigger>
            </TabsList>
            
            <TabsContent value="funnel" className="space-y-4">
              {funnelData.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={funnelData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" />
                      <YAxis />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          color: 'hsl(var(--foreground))'
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value, name) => {
                          const colors = {
                            'Page Views': '#123c9e',
                            'Signup Started': '#3c83f6', 
                            'Signup Completed': '#9fc3ff'
                          };
                          return [
                            <span style={{ color: colors[name as keyof typeof colors] || '#123c9e' }}>
                              {name}: {value}
                            </span>
                          ];
                        }}
                      />
                      <Bar dataKey="page_views" fill="#123c9e" name="Page Views" />
                      <Bar dataKey="signup_started" fill="#3c83f6" name="Signup Started" />
                      <Bar dataKey="signup_completed" fill="#9fc3ff" name="Signup Completed" />
                    </BarChart>
                  </ResponsiveContainer>
                  
                  <div className="grid gap-4">
                    {funnelData.map((data) => (
                      <div key={data.source} className="space-y-2">
                        {/* Source Row - Clickable */}
                        <div 
                          className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => handleSourceClick(data.source)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={data.source === 'referral_offer' ? 'default' : getSourceBadgeVariant(data.conversion_rate)}
                              >
                                {formatSourceName(data.source)}
                              </Badge>
            {data.source === 'referral_offer' && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Gift className="h-3 w-3" />
                20% OFF
              </Badge>
            )}
                              {data.conversion_rate > 5 && data.source !== 'referral_offer' && (
                                <Badge variant="default" className="text-xs">
                                  High Converting
                                </Badge>
                              )}
                              {/* Expand/Collapse Indicator */}
                              <span className="text-xs text-muted-foreground">
                                {expandedSource === data.source ? '▼' : '▶'}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {data.page_views} views → {data.signup_started} started → {data.signup_completed} completed
                            </div>
                          </div>
                          <div className="flex gap-4 text-sm">
                            <span>CTR: <strong>{data.ctr.toFixed(1)}%</strong></span>
                            <span>Completion: <strong>{data.completion_rate.toFixed(1)}%</strong></span>
                            <span>Conversion: <strong>{data.conversion_rate.toFixed(1)}%</strong></span>
                          </div>
                        </div>

                        {/* Campaign Breakdown (Collapsible) */}
                        {expandedSource === data.source && (
                          <div className="ml-8 space-y-2 animate-in slide-in-from-top-2">
                            {campaignData[data.source] ? (
                              campaignData[data.source].length > 0 ? (
                                campaignData[data.source].map((campaign) => (
                                  <div key={`${campaign.source}-${campaign.campaign}`} className="space-y-2">
                                    {/* Campaign Row - Clicável */}
                                    <div 
                                      className="flex items-center justify-between p-3 border border-l-4 border-l-primary/50 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                                      onClick={() => handleCampaignClick(campaign.source, campaign.campaign!)}
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs">
                                            {campaign.campaign}
                                          </Badge>
                                          {/* Expand/Collapse Indicator */}
                                          <span className="text-xs text-muted-foreground">
                                            {expandedCampaign === `${campaign.source}:${campaign.campaign}` ? '▼' : '▶'}
                                          </span>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                          {campaign.page_views} views → {campaign.signup_started} started → {campaign.signup_completed} completed
                                        </div>
                                      </div>
                                      <div className="flex gap-4 text-sm">
                                        <span>CTR: <strong>{campaign.ctr.toFixed(1)}%</strong></span>
                                        <span>Completion: <strong>{campaign.completion_rate.toFixed(1)}%</strong></span>
                                        <span>Conversion: <strong>{campaign.conversion_rate.toFixed(1)}%</strong></span>
                                      </div>
                                    </div>

                                    {/* UTM ID Breakdown (Collapsible) */}
                                    {expandedCampaign === `${campaign.source}:${campaign.campaign}` && (
                                      <div className="ml-12 space-y-2 animate-in slide-in-from-top-2">
                                        {utmIdData[`${campaign.source}:${campaign.campaign}`] ? (
                                          utmIdData[`${campaign.source}:${campaign.campaign}`].length > 0 ? (
                                            utmIdData[`${campaign.source}:${campaign.campaign}`].map((utmData) => (
                                              <div 
                                                key={`${utmData.source}-${utmData.campaign}-${utmData.utm_id}`} 
                                                className="flex items-center justify-between p-2 border border-l-2 border-l-accent rounded-lg bg-muted/20"
                                              >
                                                <div className="flex items-center gap-4">
                                                  <Badge variant="secondary" className="text-xs font-mono">
                                                    {utmData.utm_id}
                                                  </Badge>
                                                  <div className="text-xs text-muted-foreground">
                                                    {utmData.page_views} views → {utmData.signup_started} started → {utmData.signup_completed} completed
                                                  </div>
                                                </div>
                                                <div className="flex gap-3 text-xs">
                                                  <span>CTR: <strong>{utmData.ctr.toFixed(1)}%</strong></span>
                                                  <span>Completion: <strong>{utmData.completion_rate.toFixed(1)}%</strong></span>
                                                  <span>Conversion: <strong>{utmData.conversion_rate.toFixed(1)}%</strong></span>
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="p-2 text-xs text-muted-foreground text-center border rounded-lg bg-muted/10">
                                              No UTM IDs tracked for this campaign
                                            </div>
                                          )
                                        ) : (
                                          <div className="p-2 text-xs text-muted-foreground text-center border rounded-lg bg-muted/10 animate-pulse">
                                            Loading UTM IDs...
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="p-3 text-sm text-muted-foreground text-center border rounded-lg bg-muted/20">
                                  No campaigns tracked for this source
                                </div>
                              )
                            ) : (
                              <div className="p-3 text-sm text-muted-foreground text-center border rounded-lg bg-muted/20 animate-pulse">
                                Loading campaigns...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No funnel data available for the selected time range.
                </div>
              )}
            </TabsContent>

            <TabsContent value="trends">
              {timeSeriesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        color: 'hsl(var(--foreground))'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: any, name: string) => {
                        const colors: Record<string, string> = {
                          'Page Views': '#3b82f6',
                          'Signup Started': '#2563eb',
                          'Signup Completed': '#1e40af'
                        };
                        return [
                          <span style={{ color: colors[name] || '#3b82f6' }}>
                            {value}
                          </span>,
                          name
                        ];
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="page_views" 
                      stroke="#3b82f6" 
                      name="Page Views"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="signup_started" 
                      stroke="#2563eb" 
                      name="Signup Started"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="signup_completed" 
                      stroke="#1e40af" 
                      name="Signup Completed"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No time series data available for the selected time range.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}