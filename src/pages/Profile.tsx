import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/contexts/AuthContext';
import { UserProfileForm } from '@/components/UserProfileForm';
import { BillingNotifications, SubscriptionManagement } from '@/components/BillingComponents';
import { ReferralDashboard } from '@/components/ReferralDashboard';

import { UserManagementModal } from '@/components/UserManagementModal';
import { AdminTestsModal } from '@/components/AdminTestsModal';
import { SupportTicketsModal } from '@/components/SupportTicketsModal';
import { DeleteAccountModal } from '@/components/DeleteAccountModal';
import { ContactSupportModal } from '@/components/ContactSupportModal';
import { Shield, Users, CreditCard, ArrowLeft, FlaskConical, MessageCircle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showAdminTests, setShowAdminTests] = useState(false);
  const [showSupportTickets, setShowSupportTickets] = useState(false);
  const [showContactSupport, setShowContactSupport] = useState(false);

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-background-outer">
      <div className="container mx-auto py-6 space-y-6">
      {/* Billing Notifications */}
      <BillingNotifications />

      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Back')}
        </Button>

        <div className="flex-1 text-center">
          <h1 className="text-3xl font-bold">{t('profile.title', 'Profile')}</h1>
          <p className="text-muted-foreground">
            {t('profile.description', 'Manage your account settings and preferences')}
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setShowUserManagement(true)}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              {t('admin.userManagement', 'User Management')}
            </Button>
            <Button 
              onClick={() => setShowAdminTests(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FlaskConical className="h-4 w-4" />
              {t('admin.systemTests', 'System Tests')}
            </Button>
            <Button 
              onClick={() => setShowSupportTickets(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              {t('support.ticketManagement', 'Support Tickets')}
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">
            <Users className="h-4 w-4 mr-2" />
            {t('profile.title', 'Profile')}
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard className="h-4 w-4 mr-2" />
            {t('billing.title', 'Billing')}
          </TabsTrigger>
          <TabsTrigger value="referrals">
            <Share2 className="h-4 w-4 mr-2" />
            {t('referrals.title', 'Referrals')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <UserProfileForm />
          
          {/* Support Section */}
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Need Help?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  If you have any questions or issues, our support team is here to help.
                </p>
              </div>
              <Button 
                variant="link" 
                onClick={() => setShowContactSupport(true)}
                className="underline"
              >
                Contact Support
              </Button>
            </div>
          </div>
          
          {/* Delete Account Section */}
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-muted-foreground">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <DeleteAccountModal 
                userEmail={profile?.email || ''}
                onAccountDeleted={() => {
                  // Redirect to home page after account deletion
                  window.location.href = '/';
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="billing">
          <SubscriptionManagement />
        </TabsContent>

        <TabsContent value="referrals">
          <ReferralDashboard />
        </TabsContent>
      </Tabs>

      <UserManagementModal 
        open={showUserManagement} 
        onOpenChange={setShowUserManagement} 
      />
      
      <AdminTestsModal 
        open={showAdminTests} 
        onOpenChange={setShowAdminTests} 
      />

      <SupportTicketsModal 
        open={showSupportTickets} 
        onOpenChange={setShowSupportTickets} 
      />

      <ContactSupportModal 
        open={showContactSupport} 
        onOpenChange={setShowContactSupport} 
      />
      </div>
    </div>
  );
};

export default Profile;