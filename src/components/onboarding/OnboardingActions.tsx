import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, Users, BookOpen, ArrowRight } from 'lucide-react';

interface OnboardingActionsProps {
  onCreateWorkspace: () => void;
  canCreateWorkspace: boolean;
}

export function OnboardingActions({ onCreateWorkspace, canCreateWorkspace }: OnboardingActionsProps) {
  const { t } = useTranslation();
  const [showVideoModal, setShowVideoModal] = useState(false);

  const actions = [
    {
      icon: ArrowRight,
      title: t('onboarding.actions.primary.title'),
      description: t('onboarding.actions.primary.description'),
      action: onCreateWorkspace,
      variant: 'default' as const,
      disabled: !canCreateWorkspace,
      primary: true
    },
    {
      icon: Play,
      title: t('onboarding.actions.video.title'),
      description: t('onboarding.actions.video.description'),
      action: () => setShowVideoModal(true),
      variant: 'outline' as const,
      disabled: false,
      primary: false
    },
    {
      icon: BookOpen,
      title: t('onboarding.actions.docs.title'),
      description: t('onboarding.actions.docs.description'),
      action: () => window.open('https://docs.21mspace.com', '_blank'),
      variant: 'outline' as const,
      disabled: false,
      primary: false
    }
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            {t('onboarding.actions.title')}
          </h2>
          <p className="text-muted-foreground">
            {t('onboarding.actions.subtitle')}
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-4">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Card 
                key={index}
                className={`elegant-card p-6 hover-lift cursor-pointer transition-all duration-300 ${
                  action.primary ? 'ring-2 ring-primary/20 bg-gradient-primary/5' : ''
                }`}
                onClick={action.disabled ? undefined : action.action}
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="text-center space-y-4">
                  <div className={`mx-auto p-4 rounded-full ${
                    action.primary 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground">
                      {action.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  
                  <Button 
                    variant={action.variant}
                    size="sm"
                    disabled={action.disabled}
                    className="w-full"
                  >
                    {action.primary ? t('onboarding.actions.getStarted') : t('onboarding.actions.learn')}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
        
        {!canCreateWorkspace && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {t('onboarding.actions.upgradeHint')}
            </p>
          </div>
        )}
      </div>

      {/* Video Tutorial Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('onboarding.video.title')}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <video 
              controls 
              className="w-full h-full"
              poster="/placeholder.svg?height=400&width=600&text=21M+Space+Tutorial"
            >
              <source src="/21m-space-tutorial.mp4" type="video/mp4" />
              {t('onboarding.video.unsupported')}
            </video>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}