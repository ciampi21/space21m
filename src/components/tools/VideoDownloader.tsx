import { useState } from "react";
import { Download, Link as LinkIcon, AlertCircle, Music, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface VideoInfo {
  title?: string;
  duration?: string;
  filesize?: string;
}

const VideoDownloader = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const detectPlatform = (url: string): string | null => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
    if (url.includes('tiktok.com')) return 'TikTok';
    if (url.includes('instagram.com')) return 'Instagram';
    return null;
  };

  const handleDownload = async () => {
    if (!url) {
      setError('Por favor, insira uma URL válida');
      return;
    }

    const platform = detectPlatform(url);
    if (!platform) {
      setError('Plataforma não suportada. Use links do YouTube.');
      return;
    }

    if (platform !== 'YouTube') {
      setError('No momento, apenas YouTube é suportado. TikTok e Instagram em breve!');
      return;
    }

    setIsLoading(true);
    setError(null);
    setVideoInfo(null);
    setDownloadSuccess(false);

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error: functionError } = await supabase.functions.invoke('download-video', {
        body: { url }
      });

      if (functionError) throw functionError;

      if (data.success && data.downloadUrl) {
        // Set video info
        setVideoInfo(data.info);
        
        // Open download in new tab (more reliable for cross-origin downloads)
        window.open(data.downloadUrl, '_blank');
        
        setDownloadSuccess(true);
        toast.success(`Download iniciado: ${data.info?.title || 'Áudio'}`);
      } else if (data.retry) {
        // Conversion is processing, retry after delay
        toast.info('Conversão em andamento, tentando novamente...');
        setTimeout(() => handleDownload(), 3000);
      } else {
        setError(data.error || 'Erro ao baixar o áudio');
      }
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message || 'Erro ao processar o download');
    } finally {
      setIsLoading(false);
    }
  };

  const platform = url ? detectPlatform(url) : null;

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {downloadSuccess && videoInfo && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>Download iniciado!</strong>
            <br />
            {videoInfo.title && <span>Título: {videoInfo.title}</span>}
            {videoInfo.duration && <span className="ml-2">• Duração: {videoInfo.duration}</span>}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="video-url">URL do Vídeo do YouTube</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="video-url"
                placeholder="Cole aqui o link do YouTube (ex: youtube.com/watch?v=...)"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                  setDownloadSuccess(false);
                }}
                className="pl-9"
              />
            </div>
          </div>
          {platform && (
            <p className="text-sm text-muted-foreground">
              Plataforma detectada: <span className="font-medium text-primary">{platform}</span>
              {platform !== 'YouTube' && (
                <span className="text-amber-600 ml-2">(em breve)</span>
              )}
            </p>
          )}
        </div>

        <div className="bg-muted/50 p-3 rounded-lg">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Music className="h-4 w-4" />
            O download será feito em formato <strong>MP3</strong> (áudio)
          </p>
        </div>

        <Button 
          onClick={handleDownload} 
          disabled={!url || platform !== 'YouTube' || isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Convertendo...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Baixar MP3
            </>
          )}
        </Button>
      </div>

      <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
        <p className="font-medium">Plataformas Suportadas:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li className="text-primary font-medium">YouTube (vídeos e shorts) ✓</li>
          <li className="text-muted-foreground/60">TikTok (em breve)</li>
          <li className="text-muted-foreground/60">Instagram (em breve)</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
          Nota: Use apenas para baixar conteúdo que você tem direito de usar.
        </p>
      </div>
    </div>
  );
};

export default VideoDownloader;
