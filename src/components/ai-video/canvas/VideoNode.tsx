import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Play, Download, Loader2, AlertCircle, Film, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VideoGeneration } from "@/pages/AIVideo";

export type VideoNodeData = {
  label: string;
  slot: VideoGeneration;
  canGenerate: boolean;
  onGenerate: () => void;
};

type VideoNodeType = Node<VideoNodeData, 'videoNode'>;

const VideoNode = ({ data, selected }: NodeProps<VideoNodeType>) => {
  const { slot } = data;

  const statusConfig = {
    idle: { bg: "border-border/60", badge: null },
    generating: { bg: "border-blue-500/40", badge: "bg-blue-500/10 text-blue-600" },
    completed: { bg: "border-green-500/40", badge: "bg-green-500/10 text-green-600" },
    error: { bg: "border-destructive/40", badge: "bg-destructive/10 text-destructive" },
  };

  const config = statusConfig[slot.status];

  return (
    <div
      className={cn(
        "w-[240px] rounded-2xl border-2 bg-card shadow-lg transition-all duration-200 overflow-hidden",
        selected ? "border-primary shadow-xl ring-2 ring-primary/20" : config.bg + " hover:border-primary/40"
      )}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-primary-foreground"
      />

      {/* Header */}
      <div className="px-3 py-2 bg-muted/50 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center">
            <Monitor className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-foreground">{data.label}</span>
        </div>
        {config.badge && (
          <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full", config.badge)}>
            {slot.status === "generating" ? "gerando..." : slot.status === "completed" ? "completed" : "erro"}
          </span>
        )}
      </div>

      {/* Preview */}
      <div className="aspect-video relative bg-muted/30 flex items-center justify-center">
        {slot.status === "idle" && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
            <Film className="h-10 w-10" />
            <span className="text-[10px]">Preview</span>
          </div>
        )}

        {slot.status === "generating" && (
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
              <Film className="h-4 w-4 text-violet-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[10px] text-muted-foreground">1-3 minutos...</p>
          </div>
        )}

        {slot.status === "completed" && slot.videoUrl && (
          <video src={slot.videoUrl} controls autoPlay muted loop className="w-full h-full object-contain bg-black" />
        )}

        {slot.status === "error" && (
          <div className="flex flex-col items-center gap-1.5 text-destructive p-3 text-center">
            <AlertCircle className="h-8 w-8" />
            <p className="text-[10px]">{slot.error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-2 flex gap-1.5">
        {(slot.status === "idle" || slot.status === "error") && (
          <Button
            onClick={data.onGenerate}
            disabled={!data.canGenerate}
            size="sm"
            className="flex-1 h-7 text-[10px] gap-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white"
          >
            <Play className="h-3 w-3" />
            Gerar Vídeo
          </Button>
        )}

        {slot.status === "generating" && (
          <Button disabled size="sm" variant="secondary" className="flex-1 h-7 text-[10px] gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Gerando...
          </Button>
        )}

        {slot.status === "completed" && (
          <>
            <Button onClick={data.onGenerate} disabled={!data.canGenerate} variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1">
              <Play className="h-3 w-3" />
              Refazer
            </Button>
            <Button
              onClick={() => slot.videoUrl && window.open(slot.videoUrl, "_blank")}
              variant="secondary"
              size="sm"
              className="h-7 text-[10px] gap-1"
            >
              <Download className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(VideoNode);
