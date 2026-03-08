import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useStorageCalculation } from '@/hooks/useStorageCalculation';
import { Users, HardDrive, Calendar, AlertTriangle } from 'lucide-react';

interface UserEntitlements {
  max_owned_workspaces: number;
  max_guest_memberships: number;
  storage_total_mb: number;
  post_expiry_days: number;
  features: any;
  storage_used_mb: number;
}

export function PlanLimitsDisplay() {
  const { profile, user } = useAuth();
  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(null);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [guestMembershipCount, setGuestMembershipCount] = useState(0);
  const { calculateAndUpdateStorageUsage, isCalculating } = useStorageCalculation();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) {
      fetchEntitlements();
      fetchUsageCounts();
    }
  }, [user]);

  const fetchEntitlements = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_entitlements', { user_uuid: user?.id });

      if (error) {
        console.error('Error fetching entitlements:', error);
        return;
      }

      if (data && data.length > 0) {
        setEntitlements(data[0]);
      }
    } catch (error) {
      console.error('Error fetching entitlements:', error);
    }
  };

  const fetchUsageCounts = async () => {
    try {
      // Count owned workspaces
      const { count: workspaces } = await supabase
        .from('workspaces')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user?.id);

      // Count guest memberships
      const { count: memberships } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .neq('workspace_role', 'owner'); // Not counting owner roles as guest

      // Calculate and update storage usage using the specialized hook
      await calculateAndUpdateStorageUsage();
      
      // Refresh entitlements to show updated storage
      setTimeout(fetchEntitlements, 500);

      setWorkspaceCount(workspaces || 0);
      setGuestMembershipCount(memberships || 0);
    } catch (error) {
      console.error('Error fetching usage counts:', error);
    }
  };

  if (!entitlements) {
    return null;
  }

  const storagePercentage = entitlements.storage_total_mb > 0 
    ? (entitlements.storage_used_mb / entitlements.storage_total_mb) * 100 
    : 0;

  const workspacePercentage = entitlements.max_owned_workspaces > 0 
    ? (workspaceCount / entitlements.max_owned_workspaces) * 100 
    : 0;

  const getPlanTierLabel = (tier: string) => {
    switch (tier) {
      case 'free': return t('billing.planFree', 'Free');
      case 'premium': return t('billing.planPremium', 'Premium');
      case 'pro': return t('billing.planPro', 'Pro');
      default: return tier;
    }
  };

  const formatStorage = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t('billing.planLimits', 'Plan Limits & Usage')}
        </CardTitle>
        <CardDescription>
          {t('billing.planLimitsDescription', 'Monitor your plan usage and limits')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t('billing.currentPlan', 'Current Plan')}</span>
          <Badge variant={profile?.plan_tier === 'free' ? 'outline' : 'default'}>
            {getPlanTierLabel(profile?.plan_tier || 'free')}
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Workspaces */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('billing.ownedWorkspaces', 'Owned Workspaces')}
              </span>
              <span>
                {workspaceCount} / {entitlements.max_owned_workspaces === -1 
                  ? '∞' 
                  : entitlements.max_owned_workspaces}
              </span>
            </div>
            {entitlements.max_owned_workspaces > 0 && (
              <Progress 
                value={workspacePercentage} 
                className={`h-2 ${workspacePercentage > 90 ? 'bg-red-100' : 'bg-gray-100'}`} 
              />
            )}
            {workspacePercentage >= 100 ? (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t('billing.limitReached', 'Workspace Limit Reached')}
              </p>
            ) : workspacePercentage > 90 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t('billing.limitWarning', 'Approaching limit')}
              </p>
            )}
          </div>

          {/* Storage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                {t('billing.storage', 'Storage')}
              </span>
              <span>
                {formatStorage(entitlements.storage_used_mb)} / {formatStorage(entitlements.storage_total_mb)}
              </span>
            </div>
            <Progress 
              value={storagePercentage} 
              className={`h-2 ${storagePercentage > 90 ? 'bg-red-100' : 'bg-gray-100'}`} 
            />
            {storagePercentage > 90 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t('billing.storageWarning', 'Storage almost full')}
              </p>
            )}
          </div>

          {/* Post Expiry */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t('billing.postExpiry', 'Post Retention')}
              </span>
              <span>
                {entitlements.post_expiry_days === -1 
                  ? t('billing.unlimited', 'Unlimited') 
                  : `${entitlements.post_expiry_days} ${t('billing.days', 'days')}`}
              </span>
            </div>
          </div>

          {/* Guest Memberships */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('billing.guestMemberships', 'Guest Memberships')}
              </span>
              <span>
                {guestMembershipCount} / {entitlements.max_guest_memberships === -1 
                  ? '∞' 
                  : entitlements.max_guest_memberships}
              </span>
            </div>
          </div>
        </div>

        {/* Plan Features */}
        {entitlements.features && Object.keys(entitlements.features).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t('billing.planFeatures', 'Plan Features')}</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(entitlements.features).map(([feature, enabled]) => (
                <div key={feature} className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={enabled ? 'text-foreground' : 'text-muted-foreground'}>
                    {feature.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}