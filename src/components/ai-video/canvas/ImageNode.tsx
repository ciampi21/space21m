import { memo, useCallback, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type ImageNodeData = {
  label: string;
  imageFile?: File;
  imagePreview?: string;
  onImageChange: (nodeId: string, file: File | null) => void;
};

const ImageNode = ({ id, data, selected }: NodeProps & { data: ImageNodeData }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Apenas imagens são aceitas", variant: "destructive" });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Máx 10MB", variant: "destructive" });
        return;
      }
      data.onImageChange(id, file);
    },
    [data, id]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      className={cn(
        "w-[220px] rounded-2xl border-2 bg-card shadow-lg transition-all duration-200 overflow-hidden",
        selected ? "border-primary shadow-xl ring-2 ring-primary/20" : "border-border/60 hover:border-primary/40"
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-muted/50 border-b flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
          <ImageIcon className="h-3 w-3 text-white" />
        </div>
        <span className="text-xs font-semibold text-foreground truncate">{data.label}</span>
      </div>

      {/* Content */}
      <div className="p-2">
        {data.imagePreview ? (
          <div className="relative group rounded-lg overflow-hidden aspect-video bg-muted">
            <img src={data.imagePreview} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onImageChange(id, null);
              }}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 aspect-video cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
          >
            <Upload className="h-6 w-6 text-muted-foreground/60 mb-1" />
            <span className="text-[10px] text-muted-foreground font-medium">Arraste ou clique</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-primary-foreground"
      />
    </div>
  );
};

export default memo(ImageNode);
