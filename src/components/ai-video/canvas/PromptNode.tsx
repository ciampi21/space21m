import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Sparkles, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type PromptNodeData = {
  prompt: string;
  duration: string;
  aspectRatio: string;
  isEnhancing: boolean;
  onPromptChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onAspectRatioChange: (value: string) => void;
  onEnhance: () => void;
};

type PromptNodeType = Node<PromptNodeData, 'promptNode'>;

const PromptNode = ({ data, selected }: NodeProps<PromptNodeType>) => {
  return (
    <div
      className={cn(
        "w-[320px] rounded-2xl border-2 bg-card shadow-lg transition-all duration-200 overflow-hidden",
        selected ? "border-primary shadow-xl ring-2 ring-primary/20" : "border-border/60 hover:border-primary/40"
      )}
    >
      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="image-in"
        className="!w-3 !h-3 !bg-primary !border-2 !border-primary-foreground"
      />

      {/* Header */}
      <div className="px-3 py-2 bg-gradient-to-r from-blue-500/10 to-blue-400/10 border-b flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
          <Settings2 className="h-3 w-3 text-white" />
        </div>
        <span className="text-xs font-semibold text-foreground">Blueprint</span>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Model */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Modelo</label>
          <Select defaultValue="image-to-video">
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="image-to-video">Imagem para Vídeo</SelectItem>
              <SelectItem value="text-to-video">Texto para Vídeo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Aspect Ratio + Duration side by side */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Aspect ratio</label>
            <Select value={data.aspectRatio} onValueChange={data.onAspectRatioChange}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="9:16">9:16</SelectItem>
                <SelectItem value="1:1">1:1</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Duração</label>
            <Select value={data.duration} onValueChange={data.onDurationChange}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5s</SelectItem>
                <SelectItem value="10">10s</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Prompt */}
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Prompt</label>
          <Textarea
            value={data.prompt}
            onChange={(e) => data.onPromptChange(e.target.value)}
            placeholder="Descreva o vídeo que deseja criar..."
            className="min-h-[120px] text-xs resize-y mt-1"
            maxLength={1000}
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground">{data.prompt.length}/1000</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={data.onEnhance}
              disabled={data.isEnhancing || !data.prompt.trim()}
              className="h-6 px-2 text-[10px] gap-1"
            >
              {data.isEnhancing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Melhorar com IA
            </Button>
          </div>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="video-out"
        className="!w-3 !h-3 !bg-primary !border-2 !border-primary-foreground"
      />
    </div>
  );
};

export default memo(PromptNode);
