import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Instagram } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface InstagramConnectButtonProps {
  workspaceId: string;
  onSuccess?: () => void;
}

export const InstagramConnectButton = ({ workspaceId, onSuccess }: InstagramConnectButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const handleConnect = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke('instagram-oauth-start', {
        body: { workspaceId },
      });

      if (error) {
        console.error('Error starting Instagram OAuth:', error);
        toast.error(t('errors.instagram_connection_failed'));
        return;
      }

      if (data?.url) {
        // Redirect to Instagram authorization
        window.location.href = data.url;
      } else {
        toast.error(t('errors.instagram_connection_failed'));
      }
    } catch (error) {
      console.error('Error connecting Instagram:', error);
      toast.error(t('errors.instagram_connection_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleConnect}
      disabled={isLoading}
      className="gap-2"
    >
      <Instagram className="h-4 w-4" />
      {isLoading ? t('common.connecting') : t('instagram.connect')}
    </Button>
  );
};
