import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Image, Music, Video, Headphones, FileKey, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import ToolCard from "@/components/tools/ToolCard";
import ToolModal from "@/components/tools/ToolModal";
import ImageConverter from "@/components/tools/ImageConverter";
import VideoDownloader from "@/components/tools/VideoDownloader";
import VideoConverter from "@/components/tools/VideoConverter";
import AudioConverter from "@/components/tools/AudioConverter";
import PdfTool from "@/components/tools/PdfTool";

type ToolType = "image" | "youtube" | "video" | "audio" | "pdf" | "ai-video" | null;

const tools = [
  {
    id: "image" as const,
    title: "Conversor de Imagens",
    description: "Converta entre JPG, PNG, WebP e GIF",
    icon: Image,
    iconBgColor: "hsl(217 91% 95%)",
    iconColor: "hsl(217 91% 60%)",
    status: "active" as const,
  },
  {
    id: "youtube" as const,
    title: "Baixar MP3 do YouTube",
    description: "Extraia áudio de vídeos do YouTube",
    icon: Music,
    iconBgColor: "hsl(0 100% 95%)",
    iconColor: "hsl(0 100% 50%)",
    status: "active" as const,
  },
  {
    id: "video" as const,
    title: "Converter Vídeo",
    description: "Converta vídeos para MP4, WebM, MOV",
    icon: Video,
    iconBgColor: "hsl(262 83% 95%)",
    iconColor: "hsl(262 83% 58%)",
    status: "active" as const,
  },
  {
    id: "audio" as const,
    title: "Conversor de Áudio",
    description: "Converta entre MP3, WAV, AAC, OGG",
    icon: Headphones,
    iconBgColor: "hsl(142 76% 95%)",
    iconColor: "hsl(142 76% 36%)",
    status: "soon" as const,
  },
  {
    id: "pdf" as const,
    title: "Proteção de PDF",
    description: "Adicione ou remova senhas de PDFs",
    icon: FileKey,
    iconBgColor: "hsl(25 100% 95%)",
    iconColor: "hsl(25 100% 50%)",
    status: "active" as const,
  },
];

const Tools = () => {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<ToolType>(null);

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  };

  const handleToolClick = (toolId: ToolType) => {
    const tool = tools.find((t) => t.id === toolId);
    if (tool?.status === "active") {
      setActiveTool(toolId);
    }
  };

  const activeCount = tools.filter((t) => t.status === "active").length;
  const soonCount = tools.filter((t) => t.status === "soon").length;

  const getModalTitle = () => {
    switch (activeTool) {
      case "image":
        return "Conversor de Imagens";
      case "youtube":
        return "Baixar MP3 do YouTube";
      case "video":
        return "Converter Vídeo";
      case "audio":
        return "Conversor de Áudio";
      case "pdf":
        return "Proteção de PDF";
      default:
        return "";
    }
  };

  const renderToolContent = () => {
    switch (activeTool) {
      case "image":
        return <ImageConverter />;
      case "youtube":
        return <VideoDownloader />;
      case "video":
        return <VideoConverter />;
      case "audio":
        return <AudioConverter />;
      case "pdf":
        return <PdfTool />;
      default:
        return null;
    }
  };

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
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">21M</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">21M Tools</h1>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Ferramentas gratuitas para criadores
                  </p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleBack}>
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            21M Tools
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Converta, baixe e edite seus arquivos de mídia de forma rápida e gratuita
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">
                {activeCount} Ferramentas Ativas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
              <span className="text-sm text-muted-foreground">
                {soonCount} Em Breve
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-lg font-semibold text-foreground mb-6">
            Ferramentas Disponíveis
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tools.map((tool) => (
              <ToolCard
                key={tool.id}
                title={tool.title}
                description={tool.description}
                icon={tool.icon}
                iconBgColor={tool.iconBgColor}
                iconColor={tool.iconColor}
                status={tool.status}
                onClick={() => handleToolClick(tool.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Tool Modal */}
      <ToolModal
        open={activeTool !== null}
        onOpenChange={(open) => !open && setActiveTool(null)}
        title={getModalTitle()}
      >
        {renderToolContent()}
      </ToolModal>
    </div>
  );
};

export default Tools;
