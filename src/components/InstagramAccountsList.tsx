import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Instagram, Trash2, Check, X, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInstagramAccounts } from '@/hooks/useInstagramAccounts';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InstagramAccountsListProps {
  workspaceId: string;
}

export const InstagramAccountsList = ({ workspaceId }: InstagramAccountsListProps) => {
  const { t } = useTranslation();
  const { accounts, isLoading, disconnect, isDisconnecting, connect, isConnecting } = useInstagramAccounts(workspaceId);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Instagram className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Instagram className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">{t('instagram.no_accounts')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('instagram.connect_description')}
            </p>
          </div>
          <Button onClick={() => connect(workspaceId)} disabled={isConnecting} className="gap-2">
            <Instagram className="h-4 w-4" />
            {isConnecting ? t('common.connecting') : t('instagram.connect')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('instagram.connected_accounts')}</h3>
        <Button 
          onClick={() => connect(workspaceId)} 
          disabled={isConnecting} 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          {isConnecting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Instagram className="h-4 w-4" />
          )}
          {t('instagram.add_account')}
        </Button>
      </div>
      <div className="grid gap-4">
        {accounts.map((account) => (
          <Card key={account.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={account.profile_picture_url || undefined} />
                  <AvatarFallback>
                    <Instagram className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">@{account.username}</p>
                    {account.account_type && (
                      <Badge variant="secondary" className="text-xs">
                        {account.account_type}
                      </Badge>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          {account.can_publish ? (
                            <Badge variant="default" className="text-xs gap-1 bg-green-600 hover:bg-green-700">
                              <Check className="h-3 w-3" />
                              {t('instagram.can_publish')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-600">
                              <X className="h-3 w-3" />
                              {t('instagram.read_only')}
                            </Badge>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          {account.can_publish 
                            ? t('instagram.can_publish_tooltip')
                            : t('instagram.read_only_tooltip')
                          }
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('instagram.connected_at')}: {format(new Date(account.created_at), 'PPp')}
                  </p>
                  {account.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      {t('instagram.expires_at')}: {format(new Date(account.expires_at), 'PPp')}
                    </p>
                  )}
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isDisconnecting}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('instagram.disconnect')}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('instagram.disconnect_confirm', { username: account.username })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => disconnect(account.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('instagram.disconnect')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
