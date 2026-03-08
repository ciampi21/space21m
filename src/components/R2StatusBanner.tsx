import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, X } from "lucide-react";

export function R2StatusBanner() {
  const { t } = useTranslation();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const checkR2Status = () => {
      const degraded = localStorage.getItem('r2_degraded');
      const degradedSince = localStorage.getItem('r2_degraded_since');
      
      if (degraded === 'true' && degradedSince) {
        const since = parseInt(degradedSince);
        const now = Date.now();
        
        // Banner desaparece após 10 minutos sem novas falhas
        if (now - since < 10 * 60 * 1000) {
          setShowBanner(true);
        } else {
          // Limpar status de degradação
          localStorage.removeItem('r2_degraded');
          localStorage.removeItem('r2_degraded_since');
          localStorage.removeItem('r2_failures');
          localStorage.removeItem('r2_success_loads');
          setShowBanner(false);
        }
      }
    };

    // Verificar inicialmente
    checkR2Status();
    
    // Verificar periodicamente (a cada 30s)
    const interval = setInterval(checkR2Status, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.removeItem('r2_degraded');
    localStorage.removeItem('r2_degraded_since');
    localStorage.removeItem('r2_failures');
    localStorage.removeItem('r2_success_loads');
  };

  if (!showBanner) return null;

  return (
    <Alert variant="destructive" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-2xl mx-auto shadow-lg">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{t('mediaStatus.serviceUnstable')}</span>
        <button 
          onClick={handleDismiss}
          className="hover:opacity-70 transition-opacity"
          aria-label={t('mediaStatus.close')}
        >
          <X className="h-4 w-4" />
        </button>
      </AlertDescription>
    </Alert>
  );
}
