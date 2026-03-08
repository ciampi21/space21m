import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, MessageSquare, Zap } from 'lucide-react';

export function OnboardingSteps() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: Building2,
      title: t('onboarding.steps.step1.title'),
      description: t('onboarding.steps.step1.description'),
      color: 'primary'
    },
    {
      icon: Users,
      title: t('onboarding.steps.step2.title'),
      description: t('onboarding.steps.step2.description'),
      color: 'approved'
    },
    {
      icon: MessageSquare,
      title: t('onboarding.steps.step3.title'),
      description: t('onboarding.steps.step3.description'),
      color: 'scheduled'
    },
    {
      icon: Zap,
      title: t('onboarding.steps.step4.title'),
      description: t('onboarding.steps.step4.description'),
      color: 'posted'
    }
  ];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          {t('onboarding.steps.title')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t('onboarding.steps.subtitle')}
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Card 
              key={index} 
              className="border border-border/50 bg-card/50 p-4 hover:bg-card/80 transition-all duration-300 group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg bg-${step.color}/10 border border-${step.color}/20`}>
                    <Icon className={`h-4 w-4 text-${step.color}`} />
                  </div>
                  <Badge variant="outline" className="text-xs h-5">
                    {index + 1}
                  </Badge>
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-medium text-foreground text-sm">
                    {step.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}