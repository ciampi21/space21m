import React, { useState } from 'react';
import { Bell, Clock, HardDrive, AlertTriangle, X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'storage':
      return <HardDrive className="h-4 w-4" />;
    case 'workspace_limit':
      return <AlertTriangle className="h-4 w-4" />;
    case 'post_expiration':
      return <Clock className="h-4 w-4" />;
    case 'support_response':
      return <MessageCircle className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
};

const NotificationItem = ({ 
  notification, 
  onDismiss 
}: { 
  notification: Notification;
  onDismiss: (id: string) => void;
}) => {
  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'text-destructive';
      case 'warning':
        return 'text-warning';
      case 'info':
        return 'text-info';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors group">
      <div className={cn("mt-0.5", getPriorityColor(notification.priority))}>
        <NotificationIcon type={notification.type} />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground leading-tight">
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {notification.message}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto w-auto"
        onClick={() => onDismiss(notification.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};

export const NotificationButton = () => {
  const [open, setOpen] = useState(false);
  const { notifications, urgentCount, totalCount, hasNotifications, dismissNotification } = useNotifications();
  const { t } = useTranslation();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className={cn(
            "relative p-2 hover:bg-muted",
            hasNotifications && urgentCount > 0 && "text-warning hover:text-warning"
          )}
        >
          <Bell className="h-4 w-4" />
          {hasNotifications && (
            <Badge 
              variant={urgentCount > 0 ? "destructive" : "secondary"} 
              className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-xs"
            >
              {totalCount > 9 ? '9+' : totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        sideOffset={8}
      >
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {t('notifications.title')}
              {hasNotifications && (
                <Badge variant="secondary" className="ml-auto">
                  {totalCount}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {!hasNotifications ? (
              <div className="text-center py-6">
                <Bell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t('notifications.empty')}
                </p>
              </div>
            ) : (
              <>
                {notifications.map((notification) => (
                  <NotificationItem 
                    key={notification.id} 
                    notification={notification}
                    onDismiss={dismissNotification}
                  />
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};