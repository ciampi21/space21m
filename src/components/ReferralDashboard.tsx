import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, Users, Gift, TrendingUp, Loader2 } from 'lucide-react';

interface ReferralStats {
  code: string;
  tierInfo: {
    tier: number;
    paid_referrals: number;
    reward: string | null;
    next_tier: number | null;
    next_tier_at: number | null;
  };
  totalReferrals: number;
  pendingReferrals: number;
  convertedReferrals: number;
}

export function ReferralDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchReferralData();
    }
  }, [user]);

  // Auto-refresh token when tab regains focus
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && user) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            fetchReferralData();
          } else {
            await supabase.auth.refreshSession();
            fetchReferralData();
          }
        } catch (error) {
          console.error('Error refreshing session on tab focus:', error);
          toast({
            title: t('referrals.error', 'Error'),
            description: t('referrals.sessionExpired', 'Your session has expired. Please refresh the page.'),
            variant: "destructive"
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const fetchReferralData = async (retryCount = 0) => {
    try {
      // Verify token is valid before making request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && retryCount === 0) {
        await supabase.auth.refreshSession();
      }

      const { data: codeData, error: codeError } = await supabase.functions.invoke('create-referral-code');
      
      // If 401 and no retry yet, refresh token and retry once
      if (codeError && retryCount === 0 && codeError.message?.includes('non-2xx status code')) {
        console.log('Token may be expired, refreshing session and retrying...');
        await supabase.auth.refreshSession();
        return fetchReferralData(1);
      }
      
      if (codeError) throw codeError;

      const referralCode = codeData.code;

      const { data: tierData } = await supabase
        .rpc('calculate_referral_tier', { referrer_uuid: user?.id });

      const { data: referrals } = await supabase
        .from('referrals')
        .select('status')
        .eq('referrer_user_id', user?.id);

      const totalReferrals = referrals?.length || 0;
      const pendingReferrals = referrals?.filter(r => r.status === 'pending').length || 0;
      const convertedReferrals = referrals?.filter(r => r.status !== 'pending').length || 0;

      setStats({
        code: referralCode,
        tierInfo: tierData as any,
        totalReferrals,
        pendingReferrals,
        convertedReferrals
      });

    } catch (error: any) {
      console.error('Error fetching referral data:', error);
      toast({
        title: t('referrals.error', 'Error'),
        description: t('referrals.errorFetchingData', 'Failed to load referral data. Please try refreshing the page.'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    const link = `https://21m.space/early-adopters/?referralCode=${stats?.code}`;
    navigator.clipboard.writeText(link);
    toast({
      title: t('referrals.linkCopied', 'Link copied!'),
      description: t('referrals.linkCopiedDescription', 'Referral link copied to clipboard')
    });
  };

  const shareReferralLink = async () => {
    const link = `https://21m.space/early-adopters/?referralCode=${stats?.code}`;
    
    // Primeiro, sempre copiar para clipboard
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: t('referrals.linkCopied', 'Link copied!'),
        description: t('referrals.linkCopiedDescription', 'Referral link copied to clipboard')
      });
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }

    // Se suportar, também abrir o share nativo
    if (navigator.share) {
      try {
        await navigator.share({
          title: '21M Space - Gestão de Conteúdo',
          text: 'Ganhe 20% de desconto no primeiro mês com meu código de referral!',
          url: link
        });
      } catch (error) {
        // Ignora se o usuário cancelou o share
        if ((error as Error).name !== 'AbortError') {
          console.error('Erro ao compartilhar:', error);
        }
      }
    }
  };

  const getTierLabel = (tier: number) => {
    const tierKey = ['iron', 'copper', 'bronze', 'silver', 'gold', 'diamond'][tier - 1];
    return t(`referrals.tierLabels.${tierKey}`, `Tier ${tier}`);
  };

  const getRewardDescription = (reward: string | null) => {
    switch (reward) {
      case '1_month_free': return (
        <span className="flex items-center gap-1">
          <Gift className="h-4 w-4" />
          {t('referrals.rewards.oneMonthFree', '1 Month Free')}
        </span>
      );
      case '2_months_free': return (
        <span className="flex items-center gap-1">
          <Gift className="h-4 w-4" />
          {t('referrals.rewards.twoMonthsFree', '2 Months Free')}
        </span>
      );
      case '10_percent_storage_bonus': return (
        <span className="flex items-center gap-1">
          <TrendingUp className="h-4 w-4" />
          {t('referrals.rewards.storageBonus', '+10% Storage')}
        </span>
      );
      case '12_months_free': return (
        <span className="flex items-center gap-1">
          <Gift className="h-4 w-4" />
          {t('referrals.rewards.twelveMonthsFree', '12 Months Free')}
        </span>
      );
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const progressToNextTier = stats.tierInfo.next_tier_at 
    ? (stats.tierInfo.paid_referrals / stats.tierInfo.next_tier_at) * 100
    : 100;

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Share2 className="h-5 w-5" />
            {t('referrals.yourCode', 'Your Referral Code')}
          </CardTitle>
          <CardDescription>
            {t('referrals.earnRewards', 'Earn rewards for each friend who becomes a paying user')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Código de Referral */}
          <div className="relative p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border-2 border-primary/30">
            <div className="font-mono text-2xl font-bold text-center tracking-wider text-primary">
              {stats.code}
            </div>
          </div>
          
          <Button 
            onClick={shareReferralLink} 
            variant="default" 
            size="lg"
            className="w-full"
          >
            <Share2 className="h-4 w-4 mr-2" />
            {t('referrals.shareCode', 'Share Code')}
          </Button>

          {/* Separador */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t('referrals.statistics', 'Statistics')}</span>
            </div>
          </div>

          {/* Grid de Estatísticas Compacto */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{stats.totalReferrals}</div>
              <div className="text-xs text-muted-foreground">{t('referrals.total', 'Total')}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-green-600 dark:text-green-500">{stats.convertedReferrals}</div>
              <div className="text-xs text-muted-foreground">{t('referrals.converted', 'Converted')}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">{stats.pendingReferrals}</div>
              <div className="text-xs text-muted-foreground">{t('referrals.pending', 'Pending')}</div>
            </div>
          </div>

          {/* Tier Atual */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium">{t('referrals.currentTier', 'Your Current Tier')}</span>
            <Badge variant={stats.tierInfo.tier >= 5 ? 'default' : 'secondary'}>
              {getTierLabel(stats.tierInfo.tier)}
            </Badge>
          </div>

          {/* Recompensa Ativa */}
          {stats.tierInfo.reward && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
                <Gift className="h-4 w-4" />
                <span className="font-medium">{getRewardDescription(stats.tierInfo.reward)}</span>
              </div>
            </div>
          )}

          {/* Progresso para Próximo Tier */}
          {stats.tierInfo.next_tier && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('referrals.progressTo', 'Progress to')} {getTierLabel(stats.tierInfo.next_tier)}</span>
                <span className="font-medium">{stats.tierInfo.paid_referrals} / {stats.tierInfo.next_tier_at}</span>
              </div>
              <Progress value={progressToNextTier} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats.tierInfo.next_tier_at! - stats.tierInfo.paid_referrals} {t('referrals.conversionsNeeded', 'conversions needed')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            {t('referrals.benefitsByTier', 'Benefits by Tier')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Tier 1 - Iron */}
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <div className="font-medium">{t('referrals.tiers.tier1.name', 'Tier 1 - Iron')}</div>
                <div className="text-sm text-muted-foreground">{t('referrals.tiers.tier1.description', 'Free user')}</div>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {t('referrals.tiers.tier1.badge', 'Initial Tier')}
              </Badge>
            </div>

            {/* Tier 2 - Copper */}
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <div className="font-medium">{t('referrals.tiers.tier2.name', 'Tier 2 - Copper')}</div>
                <div className="text-sm text-muted-foreground">{t('referrals.tiers.tier2.description', 'Paying user')}</div>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {t('referrals.tiers.tier2.badge', 'In Progress')}
              </Badge>
            </div>

            {/* Tier 3 - Bronze */}
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <div className="font-medium">{t('referrals.tiers.tier3.name', 'Tier 3 - Bronze')}</div>
                <div className="text-sm text-muted-foreground">{t('referrals.tiers.tier3.description', '3+ paid referrals')}</div>
              </div>
              <Badge variant="default" className="flex items-center gap-1">
                <Gift className="h-3 w-3" />
                {t('referrals.rewards.oneMonthFree', '1 Month Free')}
              </Badge>
            </div>

          {/* Tier 4 - Silver */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <div className="font-medium">{t('referrals.tiers.tier4.name', 'Tier 4 - Silver')}</div>
              <div className="text-sm text-muted-foreground">{t('referrals.tiers.tier4.description', '5+ paid referrals')}</div>
            </div>
            <Badge variant="default" className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {t('referrals.rewards.storageBonus', '+10% Storage')}
            </Badge>
          </div>

          {/* Tier 5 - Gold */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <div className="font-medium">{t('referrals.tiers.tier5.name', 'Tier 5 - Gold')}</div>
              <div className="text-sm text-muted-foreground">{t('referrals.tiers.tier5.description', '10+ paid referrals')}</div>
            </div>
            <Badge variant="default" className="flex items-center gap-1">
              <Gift className="h-3 w-3" />
              {t('referrals.rewards.twoMonthsFree', '2 Months Free')}
            </Badge>
          </div>

            {/* Tier 6 - Diamond */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">{t('referrals.tiers.tier6.name', 'Tier 6 - Diamond')}</div>
                <div className="text-sm text-muted-foreground">{t('referrals.tiers.tier6.description', '50+ paid referrals')}</div>
              </div>
              <Badge variant="default" className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-pink-600">
                <Gift className="h-3 w-3" />
                {t('referrals.rewards.twelveMonthsFree', '12 Months Free')}
              </Badge>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              {t('referrals.bonusNote', 'Bonus for referred users: Everyone who uses your code gets 20% OFF their first month!')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
