import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { 
  Clock, 
  BarChart3, 
  Shield, 
  Zap, 
  Users, 
  Globe,
  CheckCircle,
  Sparkles
} from 'lucide-react';

export function OnboardingBenefits() {
  const { t } = useTranslation();

  const benefits = [
    {
      icon: Clock,
      title: t('onboarding.benefits.timeManagement.title'),
      description: t('onboarding.benefits.timeManagement.description'),
      gradient: 'from-blue-500/10 to-blue-600/5'
    },
    {
      icon: BarChart3,
      title: t('onboarding.benefits.analytics.title'),
      description: t('onboarding.benefits.analytics.description'),
      gradient: 'from-green-500/10 to-green-600/5'
    },
    {
      icon: Users,
      title: t('onboarding.benefits.collaboration.title'),
      description: t('onboarding.benefits.collaboration.description'),
      gradient: 'from-purple-500/10 to-purple-600/5'
    },
    {
      icon: Globe,
      title: t('onboarding.benefits.multiPlatform.title'),
      description: t('onboarding.benefits.multiPlatform.description'),
      gradient: 'from-orange-500/10 to-orange-600/5'
    }
  ];

  const features = [
    t('onboarding.benefits.features.scheduling'),
    t('onboarding.benefits.features.analytics'),
    t('onboarding.benefits.features.collaboration'),
    t('onboarding.benefits.features.automation')
  ];

  return (
    <div className="space-y-8">
      {/* Benefits Grid */}
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            {t('onboarding.benefits.title')}
          </h2>
          <p className="text-muted-foreground">
            {t('onboarding.benefits.subtitle')}
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <Card 
                key={index}
                className="elegant-card p-6 hover-lift group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${benefit.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg`} />
                
                <div className="relative space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {benefit.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Features List */}
      <Card className="elegant-card p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-gradient-primary/10 border border-primary/20 flex-shrink-0">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-4 flex-1">
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                {t('onboarding.benefits.whatsIncluded')}
              </h3>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}