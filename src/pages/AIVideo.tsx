import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Film, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import ImageNode from "@/components/ai-video/canvas/ImageNode";
import PromptNode from "@/components/ai-video/canvas/PromptNode";
import VideoNode from "@/components/ai-video/canvas/VideoNode";
import AssetSidebar from "@/components/ai-video/AssetSidebar";

export interface VideoGeneration {
  id: number;
  status: "idle" | "generating" | "completed" | "error";
  requestId?: string;
  statusUrl?: string;
  responseUrl?: string;
  videoUrl?: string;
  error?: string;
  progress?: number;
  dbId?: string; // DB record ID for persistence
}

const nodeTypes = {
  imageNode: ImageNode,
  promptNode: PromptNode,
  videoNode: VideoNode,
};

let imageNodeCounter = 2;
let videoNodeCounter = 2;

const AIVideoCanvas = () => {
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [historySidebarCollapsed, setHistorySidebarCollapsed] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [images, setImages] = useState<Record<string, { file: File; preview: string }>>({});
  const [slots, setSlots] = useState<Record<string, VideoGeneration>>({
    "video-1": { id: 1, status: "idle" },
    "video-2": { id: 2, status: "idle" },
  });
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  const promptRef = useRef(prompt);
  promptRef.current = prompt;

  const handleImageChange = useCallback((nodeId: string, file: File | null) => {
    if (file) {
      const preview = URL.createObjectURL(file);
      setImages((prev) => ({ ...prev, [nodeId]: { file, preview } }));
    } else {
      setImages((prev) => {
        const copy = { ...prev };
        if (copy[nodeId]) {
          URL.revokeObjectURL(copy[nodeId].preview);
          delete copy[nodeId];
        }
        return copy;
      });
    }
  }, []);

  const initialNodes: Node[] = [
    {
      id: "image-1",
      type: "imageNode",
      position: { x: 50, y: 100 },
      data: { label: "Imagem 1", onImageChange: handleImageChange },
    },
    {
      id: "image-2",
      type: "imageNode",
      position: { x: 50, y: 380 },
      data: { label: "Imagem 2", onImageChange: handleImageChange },
    },
    {
      id: "prompt-1",
      type: "promptNode",
      position: { x: 370, y: 120 },
      data: {
        prompt: "",
        duration: "5",
        aspectRatio: "16:9",
        isEnhancing: false,
        onPromptChange: () => {},
        onDurationChange: () => {},
        onAspectRatioChange: () => {},
        onEnhance: () => {},
      },
    },
    {
      id: "video-1",
      type: "videoNode",
      position: { x: 790, y: 80 },
      data: { label: "Preview", slot: { id: 1, status: "idle" }, canGenerate: false, onGenerate: () => {} },
    },
    {
      id: "video-2",
      type: "videoNode",
      position: { x: 790, y: 380 },
      data: { label: "Preview 2", slot: { id: 2, status: "idle" }, canGenerate: false, onGenerate: () => {} },
    },
  ];

  const initialEdges: Edge[] = [
    { id: "e-img1-prompt", source: "image-1", target: "prompt-1", targetHandle: "image-in", animated: true, style: { stroke: "hsl(217, 91%, 60%)", strokeWidth: 2 } },
    { id: "e-img2-prompt", source: "image-2", target: "prompt-1", targetHandle: "image-in", animated: true, style: { stroke: "hsl(217, 91%, 60%)", strokeWidth: 2 } },
    { id: "e-prompt-vid1", source: "prompt-1", sourceHandle: "video-out", target: "video-1", animated: true, style: { stroke: "hsl(217, 91%, 60%)", strokeWidth: 2 } },
    { id: "e-prompt-vid2", source: "prompt-1", sourceHandle: "video-out", target: "video-2", animated: true, style: { stroke: "hsl(217, 91%, 60%)", strokeWidth: 2 } },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge({ ...connection, animated: true, style: { stroke: "hsl(217, 91%, 60%)", strokeWidth: 2 } }, eds)
      );
    },
    [setEdges]
  );

  const enhancePrompt = async () => {
    if (!prompt.trim()) return;
    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke("enhance-video-prompt", {
        body: { prompt, imageCount: Object.keys(images).length },
      });
      if (error) throw error;
      if (data?.enhancedPrompt) {
        setPrompt(data.enhancedPrompt);
        toast({ title: "Prompt melhorado com IA! ✨" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao melhorar prompt", description: e.message, variant: "destructive" });
    } finally {
      setIsEnhancing(false);
    }
  };

  const imageToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const pollStatus = async (nodeId: string, requestId: string, statusUrl: string, dbId?: string) => {
    let attempts = 0;
    const currentPrompt = promptRef.current;
    const poll = async () => {
      attempts++;
      if (attempts > 120) {
        setSlots((prev) => ({ ...prev, [nodeId]: { ...prev[nodeId], status: "error", error: "Timeout" } }));
        // Update DB record on timeout
        if (dbId) {
          await supabase.functions.invoke("save-ai-video-generation", {
            body: { action: "update", generationId: dbId, status: "error", errorMessage: "Timeout após 10 minutos" },
          });
        }
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("check-video-status", {
          body: { requestId, statusUrl },
        });
        if (error) throw error;
        if (data?.status === "COMPLETED" && data?.videoUrl) {
          setSlots((prev) => ({ ...prev, [nodeId]: { ...prev[nodeId], status: "completed", videoUrl: data.videoUrl } }));
          toast({ title: `Vídeo gerado com sucesso! 🎬` });

          // Auto-save to DB
          if (dbId) {
            await supabase.functions.invoke("save-ai-video-generation", {
              body: { action: "update", generationId: dbId, status: "completed", videoUrl: data.videoUrl },
            });
            // Refresh history sidebar
            setHistoryRefreshTrigger((n) => n + 1);
            // Open history sidebar if collapsed
            setHistorySidebarCollapsed(false);
          }
          return;
        }
        if (data?.status === "FAILED") {
          setSlots((prev) => ({ ...prev, [nodeId]: { ...prev[nodeId], status: "error", error: "Geração falhou" } }));
          if (dbId) {
            await supabase.functions.invoke("save-ai-video-generation", {
              body: { action: "update", generationId: dbId, status: "error", errorMessage: "Geração falhou" },
            });
          }
          return;
        }
        setTimeout(poll, 5000);
      } catch {
        setTimeout(poll, 5000);
      }
    };
    setTimeout(poll, 5000);
  };

  const startGeneration = async (nodeId: string) => {
    if (!prompt.trim()) return;
    setSlots((prev) => ({
      ...prev,
      [nodeId]: { ...(prev[nodeId] || { id: 0 }), status: "generating", error: undefined, videoUrl: undefined, dbId: undefined },
    }));
    try {
      const connectedImageEdges = edges.filter(
        (e) => e.target === "prompt-1" && nodes.find((n) => n.id === e.source && n.type === "imageNode")
      );
      let imageUrl: string | undefined;
      if (connectedImageEdges.length > 0) {
        const firstImageNodeId = connectedImageEdges[0].source;
        const img = images[firstImageNodeId];
        if (img) imageUrl = await imageToBase64(img.file);
      }

      // Create DB record first
      const { data: saveData } = await supabase.functions.invoke("save-ai-video-generation", {
        body: { action: "create", prompt, duration, aspectRatio },
      });
      const dbId = saveData?.generation?.id;

      const { data, error } = await supabase.functions.invoke("generate-ai-video", {
        body: { prompt, imageUrl, duration, aspectRatio },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSlots((prev) => ({
        ...prev,
        [nodeId]: { ...prev[nodeId], requestId: data.requestId, statusUrl: data.statusUrl, responseUrl: data.responseUrl, dbId },
      }));
      pollStatus(nodeId, data.requestId, data.statusUrl, dbId);
    } catch (e: any) {
      setSlots((prev) => ({ ...prev, [nodeId]: { ...prev[nodeId], status: "error", error: e.message } }));
      toast({ title: "Erro ao gerar vídeo", description: e.message, variant: "destructive" });
    }
  };

  const nodesWithData = useMemo(() => {
    return nodes.map((node) => {
      if (node.type === "imageNode") {
        const img = images[node.id];
        return { ...node, data: { ...node.data, imagePreview: img?.preview, imageFile: img?.file, onImageChange: handleImageChange } };
      }
      if (node.type === "promptNode") {
        return { ...node, data: { ...node.data, prompt, duration, aspectRatio, isEnhancing, onPromptChange: setPrompt, onDurationChange: setDuration, onAspectRatioChange: setAspectRatio, onEnhance: enhancePrompt } };
      }
      if (node.type === "videoNode") {
        const slot = slots[node.id] || { id: 0, status: "idle" as const };
        return { ...node, data: { ...node.data, slot, canGenerate: prompt.trim().length > 0, onGenerate: () => startGeneration(node.id) } };
      }
      return node;
    });
  }, [nodes, images, prompt, duration, aspectRatio, isEnhancing, slots, handleImageChange]);

  const addImageNode = () => {
    imageNodeCounter++;
    const newId = `image-${imageNodeCounter}`;
    const newNode: Node = {
      id: newId,
      type: "imageNode",
      position: { x: 50, y: 100 + (imageNodeCounter - 1) * 280 },
      data: { label: `Imagem ${imageNodeCounter}`, onImageChange: handleImageChange },
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [
      ...eds,
      { id: `e-${newId}-prompt`, source: newId, target: "prompt-1", targetHandle: "image-in", animated: true, style: { stroke: "hsl(217, 91%, 60%)", strokeWidth: 2 } },
    ]);
  };

  const addVideoNode = () => {
    videoNodeCounter++;
    const newId = `video-${videoNodeCounter}`;
    setSlots((prev) => ({ ...prev, [newId]: { id: videoNodeCounter, status: "idle" } }));
    const newNode: Node = {
      id: newId,
      type: "videoNode",
      position: { x: 790, y: 80 + (videoNodeCounter - 1) * 300 },
      data: { label: `Preview ${videoNodeCounter}`, slot: { id: videoNodeCounter, status: "idle" }, canGenerate: false, onGenerate: () => {} },
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [
      ...eds,
      { id: `e-prompt-${newId}`, source: "prompt-1", sourceHandle: "video-out", target: newId, animated: true, style: { stroke: "hsl(217, 91%, 60%)", strokeWidth: 2 } },
    ]);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;

      try {
        const payload = JSON.parse(raw);
        if (payload.type !== "sidebar-image" || !payload.url) return;

        const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        imageNodeCounter++;
        const newId = `image-${imageNodeCounter}`;

        fetch(payload.url)
          .then((r) => r.blob())
          .then((blob) => {
            const file = new File([blob], `generated-${newId}.png`, { type: blob.type || "image/png" });
            const preview = payload.url.startsWith("data:") ? payload.url : URL.createObjectURL(file);
            setImages((prev) => ({ ...prev, [newId]: { file, preview } }));
          });

        const newNode: Node = {
          id: newId,
          type: "imageNode",
          position,
          data: { label: `Imagem ${imageNodeCounter}`, onImageChange: handleImageChange },
        };
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [
          ...eds,
          { id: `e-${newId}-prompt`, source: newId, target: "prompt-1", targetHandle: "image-in", animated: true, style: { stroke: "hsl(217, 91%, 60%)", strokeWidth: 2 } },
        ]);
      } catch {
        // ignore invalid drop data
      }
    },
    [reactFlowInstance, setNodes, setEdges, handleImageChange]
  );

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate("/tools");
  };

  return (
    <div className="h-screen w-screen flex bg-background-outer">
      <AssetSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((p) => !p)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="border-b bg-card/90 backdrop-blur-sm z-50 shrink-0">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
                  <Film className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-foreground">AI Video Studio</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={addImageNode} className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Imagem
              </Button>
              <Button variant="outline" size="sm" onClick={addVideoNode} className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Preview
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1" style={{ width: "100%", height: "100%" }}>
            <ReactFlow
              nodes={nodesWithData}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              defaultEdgeOptions={{ animated: true }}
              className="bg-background-outer"
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(217, 91%, 60%, 0.15)" />
              <Controls className="!bg-card !border-border !rounded-xl !shadow-lg" />
              <MiniMap
                className="!bg-card !border-border !rounded-xl !shadow-lg"
                nodeColor={(node) => {
                  if (node.type === "imageNode") return "hsl(217, 91%, 60%)";
                  if (node.type === "promptNode") return "hsl(217, 71%, 50%)";
                  if (node.type === "videoNode") return "hsl(142, 76%, 36%)";
                  return "hsl(215, 16%, 47%)";
                }}
                maskColor="hsl(230, 100%, 94%, 0.8)"
              />
            </ReactFlow>
          </div>

          <VideoHistorySidebar
            collapsed={historySidebarCollapsed}
            onToggle={() => setHistorySidebarCollapsed((p) => !p)}
            refreshTrigger={historyRefreshTrigger}
          />
        </div>
      </div>
    </div>
  );
};

const AIVideo = () => (
  <ReactFlowProvider>
    <AIVideoCanvas />
  </ReactFlowProvider>
);

export default AIVideo;
