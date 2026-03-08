import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ChangePasswordModal } from './ChangePasswordModal';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português (Brasil)' },
  { code: 'es', label: 'Español' },
];

const dateFormats = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
];

export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const { updateLanguage, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [username, setUsername] = useState(profile?.username || '');
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'MM/DD/YYYY'>(profile?.date_format || 'DD/MM/YYYY');

  const handleLanguageChange = async (languageCode: string) => {
    await updateLanguage(languageCode);
  };

  const handleUsernameUpdate = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          username: username.trim(),
          date_format: dateFormat
        })
        .eq('user_id', profile?.user_id);

      if (error) {
        toast({
          title: t('common.error'),
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Refresh profile to get updated data
      await refreshProfile();
      
      toast({
        title: t('common.success'),
        description: t('common.usernameChanged'),
      });
    } catch (error) {
      console.error('Username update error:', error);
      toast({
        title: t('common.error'),
        description: t('common.error'),
        variant: "destructive",
      });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Settings className="h-4 w-4" />
          <span className="sr-only">{t('common.selectLanguage')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <h3 className="font-medium text-sm">{t('common.settings')}</h3>
          
          {/* Language Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('common.selectLanguage')}</Label>
            <RadioGroup
              value={i18n.language}
              onValueChange={handleLanguageChange}
              className="space-y-2"
            >
              {languages.map((language) => (
                <div key={language.code} className="flex items-center space-x-2">
                  <RadioGroupItem value={language.code} id={language.code} />
                  <Label htmlFor={language.code} className="text-sm font-normal">
                    {t(`languages.${language.code}`)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Date Format Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('common.dateFormat')}</Label>
            <RadioGroup
              value={dateFormat}
              onValueChange={(value) => setDateFormat(value as 'DD/MM/YYYY' | 'MM/DD/YYYY')}
              className="space-y-2"
            >
              {dateFormats.map((format) => (
                <div key={format.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={format.value} id={format.value} />
                  <Label htmlFor={format.value} className="text-sm font-normal">
                    {format.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Username */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('common.username')}</Label>
            <div className="flex space-x-2">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('common.username')}
                className="flex-1"
              />
              <Button size="sm" onClick={handleUsernameUpdate}>
                {t('common.save')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Change Password */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setPasswordModalOpen(true)}
            >
              {t('common.changePassword')}
            </Button>
          </div>
        </div>
      </PopoverContent>
      
      <ChangePasswordModal 
        open={passwordModalOpen} 
        onOpenChange={setPasswordModalOpen} 
      />
    </Popover>
  );
}