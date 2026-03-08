import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Key } from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';
import { LanguageDropdown } from './LanguageDropdown';

export function UserProfileForm() {
  const { profile, user, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'MM/DD/YYYY'>('DD/MM/YYYY');
  
  const [isLoading, setIsLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setDateFormat(profile.date_format || 'DD/MM/YYYY');
      
    }
  }, [profile]);

  const validateUsername = (username: string): boolean => {
    if (!username) return true; // Allow empty username
    
    if (username.length < 3 || username.length > 30) {
      setError(t('profile.usernameLength', 'Username must be between 3-30 characters'));
      return false;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError(t('profile.usernameInvalid', 'Username can only contain letters, numbers, underscore and hyphen'));
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateUsername(username)) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: username || null,
          date_format: dateFormat
        })
        .eq('user_id', user?.id);

      if (error) {
        if (error.code === '23505') {
          setError(t('profile.usernameExists', 'This username is already taken'));
        } else {
          setError(error.message);
        }
        return;
      }

      await refreshProfile();
      toast({
        title: t('profile.updated', 'Profile updated'),
        description: t('profile.updatedDescription', 'Your profile has been successfully updated'),
      });
    } catch (error: any) {
      setError(error.message || t('common.errorGeneric', 'An error occurred'));
    } finally {
      setIsLoading(false);
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.accountInformation', 'Account Information')}</CardTitle>
          <CardDescription>
            {t('profile.accountDescription', 'Manage your account settings and preferences')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Account Information Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                {t('profile.accountDetails', 'Account Details')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('profile.email', 'Email')}</Label>
                  <Input value={profile?.email || ''} disabled className="bg-muted" />
                </div>
                
                <div className="space-y-2">
                  <Label>{t('profile.planTier', 'Plan')}</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={getPlanTierLabel(profile?.plan_tier || 'free')} 
                      disabled 
                      className="bg-muted flex-1" 
                    />
                    {profile?.is_early_adopter && (
                      <span className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded-md whitespace-nowrap">
                        {t('billing.earlyAdopter', 'Early Adopter')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('profile.role', 'Role')}</Label>
                  <Input value={profile?.role || ''} disabled className="bg-muted" />
                </div>
              </div>
            </div>

            {/* Personal Settings Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                {t('profile.personalSettings', 'Personal Settings')}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">{t('profile.username', 'Username')}</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('profile.usernamePlaceholder', 'Enter your username')}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('profile.usernameHint', 'Optional. Use letters, numbers, underscore and hyphen only')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateFormat">{t('profile.dateFormat', 'Date Format')}</Label>
                  <Select value={dateFormat} onValueChange={(value: 'DD/MM/YYYY' | 'MM/DD/YYYY') => setDateFormat(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('profile.language', 'Language')}</Label>
                  <LanguageDropdown />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowChangePassword(true)}
                className="flex items-center gap-2"
              >
                <Key className="h-4 w-4" />
                {t('auth.changePassword', 'Change Password')}
              </Button>

              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('profile.saveChanges', 'Save Changes')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ChangePasswordModal 
        open={showChangePassword} 
        onOpenChange={setShowChangePassword} 
      />
    </>
  );
}