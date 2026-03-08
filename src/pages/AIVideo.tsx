import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Play, Download, Loader2, Upload, X, Film, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import VideoSlot from "@/components/ai-video/VideoSlot";
import ImageUploadZone from "@/components/ai-video/ImageUploadZone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface VideoGeneration {
  id: number;
  status: "idle" | "generating" | "completed" | "error";
  requestId?: string;
  statusUrl?: string;
  responseUrl?: string;
  videoUrl?: string;
  error?: string;
  progress?: number;
}

const AIVideo = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [slots, setSlots] = useState<VideoGeneration[]>([
    { id: 1, status: "idle" },
    { id: 2, status: "idle" },
  ]);

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/tools");
    }
  };

  const handleImageAdd = useCallback((file: File) => {
    if (images.length >= 2) {
      toast({ title: "Máximo de 2 imagens", variant: "destructive" });
      return;
    }
    const preview = URL.createObjectURL(file);
    setImages((prev) => [...prev, { file, preview }]);
  }, [images.length]);

  const handleImageRemove = useCallback((index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const enhancePrompt = async () => {
    if (!prompt.trim()) {
      toast({ title: "Digite um prompt primeiro", variant: "destructive" });
      return;
    }
    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke("enhance-video-prompt", {
        body: { prompt, imageCount: images.length },
      });
      if (error) throw error;
      if (data?.enhancedPrompt) {
        setPrompt(data.enhancedPrompt);
        toast({ title: "Prompt melhorado com IA! ✨" });
      }
    } catch (e: any) {
      console.error("Enhance error:", e);
      toast({ title: "Erro ao melhorar prompt", description: e.message, variant: "destructive" });
    } finally {
      setIsEnhancing(false);
    }
  };

  const imageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const startGeneration = async (slotId: number) => {
    if (!prompt.trim()) {
      toast({ title: "Digite um prompt", variant: "destructive" });
      return;
    }

    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, status: "generating" as const, error: undefined, videoUrl: undefined } : s))
    );

    try {
      let imageUrl: string | undefined;
      if (images.length > 0) {
        imageUrl = await imageToBase64(images[0].file);
      }

      const { data, error } = await supabase.functions.invoke("generate-ai-video", {
        body: { prompt, imageUrl, duration, aspectRatio },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSlots((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? { ...s, requestId: data.requestId, statusUrl: data.statusUrl, responseUrl: data.responseUrl }
            : s
        )
      );

      // Start polling
      pollStatus(slotId, data.requestId, data.statusUrl);
    } catch (e: any) {
      console.error("Generation error:", e);
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, status: "error" as const, error: e.message } : s))
      );
      toast({ title: "Erro ao gerar vídeo", description: e.message, variant: "destructive" });
    }
  };

  const pollStatus = async (slotId: number, requestId: string, statusUrl: string) => {
    const maxAttempts = 120; // 10 minutes with 5s intervals
    let attempts = 0;

    const poll = async () => {
      attempts++;
      if (attempts > maxAttempts) {
        setSlots((prev) =>
          prev.map((s) => (s.id === slotId ? { ...s, status: "error" as const, error: "Timeout: geração demorou muito" } : s))
        );
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("check-video-status", {
          body: { requestId, statusUrl },
        });

        if (error) throw error;

        if (data?.status === "COMPLETED" && data?.videoUrl) {
          setSlots((prev) =>
            prev.map((s) => (s.id === slotId ? { ...s, status: "completed" as const, videoUrl: data.videoUrl } : s))
          );
          toast({ title: `Vídeo ${slotId} gerado com sucesso! 🎬` });
          return;
        }

        if (data?.status === "FAILED") {
          setSlots((prev) =>
            prev.map((s) => (s.id === slotId ? { ...s, status: "error" as const, error: "Geração falhou no servidor" } : s))
          );
          return;
        }

        // Still in progress
        setTimeout(poll, 5000);
      } catch (e: any) {
        console.error("Poll error:", e);
        setTimeout(poll, 5000);
      }
    };

    setTimeout(poll, 5000);
  };

  const canGenerate = prompt.trim().length > 0;
  const generatingCount = slots.filter((s) => s.status === "generating").length;

  return (
    <div className="min-h-screen bg-background-outer">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <Film className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">AI Video Creator</h1>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Crie vídeos com inteligência artificial
                  </p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/tools")}>
              Voltar às Ferramentas
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            Powered by Kling v2
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Crie Vídeos com IA
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Faça upload de imagens, escreva um prompt e gere vídeos incríveis em segundos
          </p>
        </div>

        {/* Image Upload Section */}
        <div className="mb-8">
          <Label className="text-sm font-semibold text-foreground mb-3 block">
            <ImageIcon className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Imagens de Referência (opcional, máx. 2)
          </Label>
          <div className="grid grid-cols-2 gap-4">
            {images.map((img, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-primary/20 aspect-video bg-muted">
                <img src={img.preview} alt={`Imagem ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => handleImageRemove(i)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-xs">
                  Imagem {i + 1}
                </span>
              </div>
            ))}
            {images.length < 2 && (
              <ImageUploadZone onFileSelect={handleImageAdd} />
            )}
          </div>
        </div>

        {/* Prompt Section */}
        <div className="mb-8">
          <Label className="text-sm font-semibold text-foreground mb-3 block">
            <Sparkles className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Prompt de Geração
          </Label>
          <div className="relative">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva o vídeo que você quer criar... Ex: 'Uma câmera fazendo um dolly zoom em uma paisagem montanhosa ao pôr do sol, com nuvens se movendo suavemente'"
              className="min-h-[120px] pr-4 text-base resize-none"
              maxLength={1000}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">{prompt.length}/1000</span>
              <Button
                variant="outline"
                size="sm"
                onClick={enhancePrompt}
                disabled={isEnhancing || !prompt.trim()}
                className="gap-1.5"
              >
                {isEnhancing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Melhorar com IA
              </Button>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <Label className="text-sm font-medium mb-2 block">Duração</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 segundos</SelectItem>
                <SelectItem value="10">10 segundos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Proporção</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Video Generation Slots */}
        <div className="mb-8">
          <Label className="text-sm font-semibold text-foreground mb-3 block">
            <Film className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Geração de Vídeos (até 2 em paralelo)
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slots.map((slot) => (
              <VideoSlot
                key={slot.id}
                slot={slot}
                canGenerate={canGenerate}
                onGenerate={() => startGeneration(slot.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIVideo;
