import { Play, Download, Loader2, AlertCircle, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VideoGeneration } from "@/pages/AIVideo";
import { cn } from "@/lib/utils";

interface VideoSlotProps {
  slot: VideoGeneration;
  canGenerate: boolean;
  onGenerate: () => void;
}

const VideoSlot = ({ slot, canGenerate, onGenerate }: VideoSlotProps) => {
  const handleDownload = () => {
    if (slot.videoUrl) {
      window.open(slot.videoUrl, "_blank");
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border-2 overflow-hidden transition-all duration-300",
        slot.status === "completed"
          ? "border-green-500/30 bg-green-500/5"
          : slot.status === "generating"
          ? "border-blue-500/30 bg-blue-500/5"
          : slot.status === "error"
          ? "border-destructive/30 bg-destructive/5"
          : "border-muted-foreground/15 bg-card"
      )}
    >
      {/* Video Preview Area */}
      <div className="aspect-video relative bg-muted/50 flex items-center justify-center">
        {slot.status === "idle" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Film className="h-12 w-12 opacity-40" />
            <span className="text-sm">Vídeo {slot.id}</span>
          </div>
        )}

        {slot.status === "generating" && (
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-violet-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Film className="h-5 w-5 text-violet-500" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Gerando vídeo...</p>
              <p className="text-xs text-muted-foreground mt-1">Isso pode levar 1-3 minutos</p>
            </div>
          </div>
        )}

        {slot.status === "completed" && slot.videoUrl && (
          <video
            src={slot.videoUrl}
            controls
            className="w-full h-full object-contain bg-black"
            autoPlay
            muted
            loop
          />
        )}

        {slot.status === "error" && (
          <div className="flex flex-col items-center gap-2 text-destructive p-4 text-center">
            <AlertCircle className="h-10 w-10" />
            <p className="text-sm font-medium">Erro na geração</p>
            <p className="text-xs opacity-80">{slot.error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 flex gap-2">
        {(slot.status === "idle" || slot.status === "error") && (
          <Button
            onClick={onGenerate}
            disabled={!canGenerate}
            className="flex-1 gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white"
          >
            <Play className="h-4 w-4" />
            Gerar Vídeo {slot.id}
          </Button>
        )}

        {slot.status === "generating" && (
          <Button disabled className="flex-1 gap-2" variant="secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando...
          </Button>
        )}

        {slot.status === "completed" && (
          <>
            <Button onClick={onGenerate} disabled={!canGenerate} variant="outline" className="flex-1 gap-2">
              <Play className="h-4 w-4" />
              Gerar Novamente
            </Button>
            <Button onClick={handleDownload} variant="secondary" className="gap-2">
              <Download className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoSlot;
