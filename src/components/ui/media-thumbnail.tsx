import { EnhancedSkeleton } from "@/components/ui/enhanced-skeleton";
import { Play, ImageIcon, Video } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface MediaThumbnailProps {
  url: string;
  isLoading: boolean;
  isVideo: boolean;
  alt: string;
  className?: string;
}

export function MediaThumbnail({ url, isLoading, isVideo, alt, className = "" }: MediaThumbnailProps) {
  const { t } = useTranslation();
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const imageLoadingRef = useRef(true);
  
  useEffect(() => {
    if (!url || url.trim() === '' || isLoading) return;
    
    // Reset states when URL changes
    setImageError(false);
    setImageLoading(true);
    imageLoadingRef.current = true;
    
    // Timeout de 10s para carregamento de imagens R2
    const timeout = setTimeout(() => {
      if (imageLoadingRef.current) {
        console.warn('R2 image timeout:', url);
        setImageError(true);
        
        // Detectar falha passivamente (localStorage)
        const now = Date.now();
        const failures = JSON.parse(localStorage.getItem('r2_failures') || '[]');
        failures.push(now);
        
        // Manter apenas falhas dos últimos 5 minutos
        const recentFailures = failures.filter((t: number) => now - t < 5 * 60 * 1000);
        localStorage.setItem('r2_failures', JSON.stringify(recentFailures));
        
        if (recentFailures.length >= 3) {
          localStorage.setItem('r2_degraded', 'true');
          localStorage.setItem('r2_degraded_since', now.toString());
        }
      }
    }, 10000);
    
    return () => clearTimeout(timeout);
  }, [url, isLoading]);
  
  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <EnhancedSkeleton className="w-full h-full" />
      </div>
    );
  }

  if (!url || url.trim() === '' || imageError) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}>
        <div className="text-center">
          {isVideo ? (
            <div className="flex flex-col items-center gap-2">
              <Video className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm">{imageError ? t('mediaStatus.mediaUnavailable') : t('mediaStatus.videoUnavailable')}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm">{imageError ? t('mediaStatus.imageUnavailable') : t('mediaStatus.imageNotAvailable')}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleImageLoad = () => {
    setImageLoading(false);
    imageLoadingRef.current = false;
    
    // Limpar estado de degradação se imagens estão carregando bem
    const now = Date.now();
    const degradedSince = localStorage.getItem('r2_degraded_since');
    if (degradedSince) {
      const successLoads = JSON.parse(localStorage.getItem('r2_success_loads') || '[]');
      successLoads.push(now);
      
      // Manter apenas sucessos dos últimos 2 minutos
      const recentSuccesses = successLoads.filter((t: number) => now - t < 2 * 60 * 1000);
      localStorage.setItem('r2_success_loads', JSON.stringify(recentSuccesses));
      
      // Se temos 5+ carregamentos bem-sucedidos recentes, limpar degradação
      if (recentSuccesses.length >= 5) {
        localStorage.removeItem('r2_degraded');
        localStorage.removeItem('r2_degraded_since');
        localStorage.removeItem('r2_failures');
        localStorage.removeItem('r2_success_loads');
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      <img
        src={url}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
        onLoad={handleImageLoad}
        onError={() => {
          console.error('R2 image load error:', url);
          setImageError(true);
          setImageLoading(false);
          imageLoadingRef.current = false;
        }}
      />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/50 rounded-full p-2 transition-all duration-200 hover:bg-black/70">
            <Play className="h-6 w-6 text-white" fill="currentColor" />
          </div>
        </div>
      )}
    </div>
  );
}
