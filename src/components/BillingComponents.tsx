import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CreditCard, ExternalLink, AlertTriangle, Crown } from 'lucide-react';
import { PlanLimitsDisplay } from '@/components/PlanLimitsDisplay';
import { ContactSupportModal } from '@/components/ContactSupportModal';

export function BillingNotifications() {
  const { profile } = useAuth();
  const { t } = useTranslation();

  // Show billing banner if exists
  if (!profile?.billing_banner) {
    return null;
  }

  const isPastDue = profile.subscription_status === 'past_due';
  const gracePeriod = profile.grace_until ? new Date(profile.grace_until) : null;
  const isInGracePeriod = gracePeriod && gracePeriod > new Date();

  return (
    <Alert variant={isPastDue ? 'destructive' : 'default'} className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="flex items-center justify-between">
          <span>{profile.billing_banner}</span>
          {isInGracePeriod && (
            <span className="text-sm">
              {t('billing.graceUntil', 'Grace period until')} {gracePeriod.toLocaleDateString()}
            </span>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function SubscriptionManagement() {
  const { profile, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [showContactSupport, setShowContactSupport] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();

  const handleOpenCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error || !data?.url) {
        throw new Error(data?.error || error?.message || 'Failed to open customer portal');
      }

      // Open portal in new tab
      window.open(data.url, '_blank');
    } catch (error: any) {
      toast({
        title: t('billing.error', 'Error'),
        description: error.message || t('billing.portalError', 'Failed to open customer portal'),
        variant: 'destructive'
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleRefreshSubscription = async () => {
    setIsLoading(true);
    try {
      await refreshProfile();
      toast({
        title: t('billing.refreshed', 'Subscription refreshed'),
        description: t('billing.refreshedDescription', 'Your subscription status has been updated'),
      });
    } catch (error: any) {
      toast({
        title: t('billing.error', 'Error'),
        description: error.message || t('billing.refreshError', 'Failed to refresh subscription'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-authenticated');
      
      if (error || !data?.url) {
        throw new Error(data?.error || error?.message || 'Failed to create checkout session');
      }

      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: t('billing.error', 'Error'),
        description: error.message || t('billing.upgradeError', 'Failed to start upgrade process'),
        variant: 'destructive'
      });
      setUpgradeLoading(false);
    }
  };

  const getPlanBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'pro': return 'default';
      case 'premium': return 'secondary';
      case 'free': return 'outline';
      default: return 'outline';
    }
  };

  const getPlanTierLabel = (tier: string) => {
    switch (tier) {
      case 'free': return t('billing.planFree', 'Free');
      case 'premium': return t('billing.planPremium', 'Premium');
      case 'pro': return t('billing.planPro', 'Pro');
      default: return tier;
    }
  };

  const getSubscriptionStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return t('billing.statusActive', 'Active');
      case 'past_due': return t('billing.statusPastDue', 'Past Due');
      case 'canceled': return t('billing.statusCanceled', 'Canceled');
      case 'trialing': return t('billing.statusTrialing', 'Trialing');
      default: return status;
    }
  };

  const getSubscriptionStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'trialing': return 'secondary';
      case 'past_due': return 'destructive';
      case 'canceled': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t('billing.subscriptionManagement', 'Subscription Management')}
        </CardTitle>
        <CardDescription>
          {t('billing.subscriptionDescription', 'Manage your subscription and billing information')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <PlanLimitsDisplay />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={handleOpenCustomerPortal}
            disabled={portalLoading || !profile?.stripe_customer_id}
            className="flex items-center gap-2"
          >
            {portalLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <ExternalLink className="h-4 w-4" />
            {t('billing.manageSubscription', 'Manage Subscription')}
          </Button>

          <Button 
            variant="outline"
            onClick={handleRefreshSubscription}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('billing.refreshStatus', 'Refresh Status')}
          </Button>

          {(profile?.plan_tier === 'free' || !profile?.subscription_active) && (
            <Button 
              variant="default"
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              className="flex items-center gap-2"
            >
              {upgradeLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Crown className="h-4 w-4" />
              {t('billing.upgradePlan', 'Upgrade Plan')}
            </Button>
          )}
        </div>

        {!profile?.stripe_customer_id && (
          <Alert>
            <AlertDescription>
              {t('billing.noStripeCustomer', 'No billing information found. If you have an active subscription, please')}{' '}
              <Button 
                variant="link" 
                className="h-auto p-0 text-inherit underline"
                onClick={() => setShowContactSupport(true)}
              >
                {t('support.contactSupport', 'contact support')}
              </Button>
              .
            </AlertDescription>
          </Alert>
        )}

        <ContactSupportModal 
          open={showContactSupport} 
          onOpenChange={setShowContactSupport} 
        />
      </CardContent>
    </Card>
  );
}