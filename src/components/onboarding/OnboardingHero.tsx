import { Rocket, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface OnboardingHeroProps {
  onCreateWorkspace: () => void;
  isModalOpen?: boolean;
}

export function OnboardingHero({ onCreateWorkspace, isModalOpen = false }: OnboardingHeroProps) {
  const { t } = useTranslation();
  const [shouldShake, setShouldShake] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Start calling attention after 10 seconds
    const initialTimer = setTimeout(() => {
      setShouldShake(true);
    }, 10000);

    return () => clearTimeout(initialTimer);
  }, []);

  return (
    <div className="relative overflow-hidden bg-gradient-hero rounded-2xl p-8 lg:p-12 text-white">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
      <div className="absolute top-4 right-4 animate-float">
        <Sparkles className="h-8 w-8 text-primary-glow opacity-60" />
      </div>
      <div className="absolute bottom-4 left-4 animate-bounce-gentle">
        <div className="h-3 w-3 bg-primary-glow rounded-full opacity-40" />
      </div>
      
      <div className="relative grid lg:grid-cols-2 gap-8 items-center">
        {/* Content */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight">
              {t('onboarding.hero.title')}
            </h1>
            <p className="text-lg text-white/95 leading-relaxed font-medium">
              {t('onboarding.hero.subtitle')}
            </p>
          </div>
          
          {/* Main CTA Button - Prominent */}
          <div className="space-y-4">
            <Button 
              onClick={onCreateWorkspace}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              size="lg"
              className={`bg-white text-primary hover:bg-white/95 px-10 py-4 text-xl font-bold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 border-2 border-white/20 rounded-xl ${shouldShake && !isHovered && !isModalOpen ? 'animate-subtle-pulse' : ''}`}
            >
              {t('dashboard.createWorkspace')}
            </Button>
          </div>
        </div>
        
        {/* Visual - More discrete */}
        <div className="flex justify-center lg:justify-end opacity-60">
          <div className="relative">
            <div className="h-28 w-28 lg:h-32 lg:w-32 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm animate-scale-in">
              <Rocket className="h-12 w-12 lg:h-16 lg:w-16 text-white animate-float" />
            </div>
            {/* Decorative rings - more subtle */}
            <div className="absolute inset-0 border border-white/10 rounded-full animate-pulse" />
            <div className="absolute -inset-3 border border-white/5 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
        </div>
      </div>
    </div>
  );
}