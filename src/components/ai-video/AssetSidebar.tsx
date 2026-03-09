import { useState, useCallback, useRef, useEffect } from "react";
import { Sparkles, Upload, Image as ImageIcon, Loader2, PanelLeftClose, PanelLeftOpen, Trash2, GripVertical, Wand2, Download, Eye, Film, Play, Lock, RefreshCw, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface VideoGenRecord {
  id: string;
  prompt: string;
  duration: string;
  aspect_ratio: string;
  video_url: string | null;
  thumbnail_url: string | null;
  status: "generating" | "completed" | "error";
  is_permanent: boolean;
  expires_at: string | null;
  created_at: string;
  error_message: string | null;
}

export interface SidebarAsset {
  id: string;
  url: string; // base64 data URL or object URL
  prompt?: string;
  isGenerating?: boolean;
}

interface AssetSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  refreshTrigger?: number;
}

export default function AssetSidebar({ collapsed, onToggle, refreshTrigger }: AssetSidebarProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<SidebarAsset[]>([]);
  const [uploadedAssets, setUploadedAssets] = useState<SidebarAsset[]>([]);
  const [selectedImage, setSelectedImage] = useState<SidebarAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Video history state
  const [videoRecords, setVideoRecords] = useState<VideoGenRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [confirmPermanent, setConfirmPermanent] = useState<VideoGenRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VideoGenRecord | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<VideoGenRecord | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-ai-video-generations", {
        body: { page: 1, limit: 50 },
      });
      if (error) throw error;
      setVideoRecords(data?.generations || []);
    } catch (e: any) {
      console.error("Error fetching video history:", e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger, fetchHistory]);

  const makePermanent = async (record: VideoGenRecord) => {
    setActionLoading(record.id);
    try {
      const { error } = await supabase.functions.invoke("manage-ai-video-generation", {
        body: { action: "make_permanent", generationId: record.id },
      });
      if (error) throw error;
      setVideoRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, is_permanent: true, expires_at: null } : r))
      );
      toast({ title: "🔒 Vídeo salvo permanentemente!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
      setConfirmPermanent(null);
    }
  };

  const deleteRecord = async (record: VideoGenRecord) => {
    setActionLoading(record.id);
    try {
      const { error } = await supabase.functions.invoke("manage-ai-video-generation", {
        body: { action: "delete", generationId: record.id },
      });
      if (error) throw error;
      setVideoRecords((prev) => prev.filter((r) => r.id !== record.id));
      toast({ title: "Vídeo removido do histórico" });
    } catch (e: any) {
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
      setConfirmDelete(null);
    }
  };

  const downloadVideo = async (record: VideoGenRecord) => {
    if (!record.video_url) return;
    try {
      const a = document.createElement("a");
      a.href = record.video_url;
      a.download = `video-${record.id}.mp4`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast({ title: "Erro ao baixar vídeo", variant: "destructive" });
    }
  };

  const getExpiryInfo = (record: VideoGenRecord) => {
    if (record.is_permanent) return { label: "Permanente 🔒", urgent: false };
    if (!record.expires_at) return { label: "—", urgent: false };
    const days = differenceInDays(new Date(record.expires_at), new Date());
    if (days <= 0) return { label: "Expirado", urgent: true };
    if (days <= 7) return { label: `Expira em ${days}d ⚠️`, urgent: true };
    return { label: `Expira em ${days}d`, urgent: false };
  };

  const enhancePrompt = useCallback(async () => {
    if (!prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke("enhance-video-prompt", {
        body: { prompt: prompt.trim(), imageCount: 1 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.enhancedPrompt) {
        setPrompt(data.enhancedPrompt);
        toast({ title: "Prompt melhorado com IA" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao melhorar prompt", description: e.message, variant: "destructive" });
    } finally {
      setIsEnhancing(false);
    }
  }, [prompt, isEnhancing]);

  const downloadImage = useCallback(async (asset: SidebarAsset) => {
    try {
      const response = await fetch(asset.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Imagem baixada com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao baixar imagem", variant: "destructive" });
    }
  }, []);

  const generateImage = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    const tempId = `gen-${Date.now()}`;

    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-image", {
        body: { prompt: prompt.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.imageUrl) throw new Error("No image returned");

      setGeneratedAssets((prev) => [
        { id: tempId, url: data.imageUrl, prompt: prompt.trim() },
        ...prev,
      ]);
      setPrompt("");
      toast({ title: "Imagem gerada com sucesso! 🎨" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar imagem", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, isGenerating]);

  const handleUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Máx 10MB por imagem", variant: "destructive" });
        return;
      }
      const url = URL.createObjectURL(file);
      setUploadedAssets((prev) => [{ id: `upload-${Date.now()}-${Math.random()}`, url }, ...prev]);
    });
  }, []);

  const onDragStart = (e: React.DragEvent, asset: SidebarAsset) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "sidebar-image", url: asset.url }));
    e.dataTransfer.effectAllowed = "copy";
  };

  const removeAsset = (id: string, list: "generated" | "uploaded") => {
    if (list === "generated") setGeneratedAssets((p) => p.filter((a) => a.id !== id));
    else setUploadedAssets((p) => p.filter((a) => a.id !== id));
  };

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-r border-white/10 flex flex-col items-center py-3 gap-2" style={{ backgroundColor: 'hsl(222, 47%, 11%)' }}>
        <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10">
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
        <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center">
          <ImageIcon className="h-3 w-3 text-white" />
        </div>
      </div>
    );
  }

  const AssetGrid = ({ assets, list }: { assets: SidebarAsset[]; list: "generated" | "uploaded" }) => (
    <div className="grid grid-cols-2 gap-1.5">
      {assets.map((asset) => (
        <div
          key={asset.id}
          draggable
          onDragStart={(e) => onDragStart(e, asset)}
          className="group relative aspect-square rounded-lg overflow-hidden border border-border/50 cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary/40 transition-all bg-muted"
        >
          <img src={asset.url} alt={asset.prompt || "Asset"} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2">
            <GripVertical className="h-5 w-5 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(asset);
              }}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white opacity-0 group-hover:opacity-100 transition-all"
              title="Ver imagem"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(asset);
              }}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white opacity-0 group-hover:opacity-100 transition-all"
              title="Baixar imagem"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeAsset(asset.id, list);
            }}
            className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 hover:bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-all"
            title="Remover"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-72 shrink-0 border-r border-white/10 backdrop-blur-sm flex flex-col overflow-hidden text-white" style={{ backgroundColor: 'hsl(222, 47%, 11%)' }}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center">
            <ImageIcon className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-white">Assets</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggle} className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10">
          <PanelLeftClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="generate" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-2 mt-2 grid grid-cols-3 h-8 bg-white/10">
          <TabsTrigger value="generate" className="text-[11px] gap-1 text-white/70 data-[state=active]:bg-white/20 data-[state=active]:text-white">
            <Sparkles className="h-3 w-3" /> Gerar
          </TabsTrigger>
          <TabsTrigger value="upload" className="text-[11px] gap-1 text-white/70 data-[state=active]:bg-white/20 data-[state=active]:text-white">
            <Upload className="h-3 w-3" /> Upload
          </TabsTrigger>
          <TabsTrigger value="history" className="text-[11px] gap-1 text-white/70 data-[state=active]:bg-white/20 data-[state=active]:text-white">
            <Film className="h-3 w-3" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="flex-1 flex flex-col overflow-hidden m-0 px-2 pt-2 gap-2">
          <Textarea
            placeholder="Descreva a imagem que deseja gerar..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="text-xs min-h-[120px] resize-y bg-white/10 border-white/20 text-white placeholder:text-white/40"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                generateImage();
              }
            }}
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={enhancePrompt}
              disabled={!prompt.trim() || isEnhancing || isGenerating}
              className="h-8 px-2.5 text-[10px] gap-1 border-white/20 text-white/70 hover:text-white hover:bg-white/10 bg-transparent"
              title="Melhorar prompt com IA"
            >
              {isEnhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              Melhorar
            </Button>
            <Button
              size="sm"
              onClick={generateImage}
              disabled={!prompt.trim() || isGenerating}
              className="flex-1 h-8 text-xs gap-1.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isGenerating ? "Gerando..." : "Gerar Imagem"}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto pb-2">
            {generatedAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/40">
                <Sparkles className="h-8 w-8 mb-2 opacity-30" />
                <span className="text-[11px]">Imagens geradas aparecerão aqui</span>
              </div>
            ) : (
              <AssetGrid assets={generatedAssets} list="generated" />
            )}
          </div>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="flex-1 flex flex-col overflow-hidden m-0 px-2 pt-2 gap-2">
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleUpload(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 h-20 cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all"
          >
            <Upload className="h-5 w-5 text-white/40 mb-1" />
            <span className="text-[10px] text-white/50 font-medium">Arraste ou clique para enviar</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
          />
          <div className="flex-1 overflow-y-auto pb-2">
            {uploadedAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-white/40">
                <ImageIcon className="h-8 w-8 mb-2 opacity-30" />
                <span className="text-[11px]">Uploads aparecerão aqui</span>
              </div>
            ) : (
              <AssetGrid assets={uploadedAssets} list="uploaded" />
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-3xl bg-zinc-950 border-white/10 p-1">
          <DialogTitle className="sr-only">Visualizar Imagem</DialogTitle>
          {selectedImage && (
            <div className="relative flex flex-col gap-4 p-4">
              <div className="w-full flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">Visualizar Imagem</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadImage(selectedImage)}
                  className="gap-2 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Download className="h-4 w-4" />
                  Baixar Imagem
                </Button>
              </div>
              <div className="relative rounded-lg overflow-hidden flex items-center justify-center bg-black/50 min-h-[50vh]">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.prompt || "Preview"}
                  className="max-h-[70vh] object-contain"
                />
              </div>
              {selectedImage.prompt && (
                <div className="bg-white/5 p-3 rounded-md text-xs text-white/80 border border-white/10">
                  <span className="font-semibold text-white/90 mr-2">Prompt:</span>
                  {selectedImage.prompt}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
