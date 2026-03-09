import { useState, useEffect, useCallback } from "react";
import { Film, PanelRightClose, PanelRightOpen, Loader2, Play, Download, Lock, Trash2, Clock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface VideoHistorySidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  refreshTrigger?: number;
}

export default function VideoHistorySidebar({ collapsed, onToggle, refreshTrigger }: VideoHistorySidebarProps) {
  const [records, setRecords] = useState<VideoGenRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmPermanent, setConfirmPermanent] = useState<VideoGenRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VideoGenRecord | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<VideoGenRecord | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-ai-video-generations", {
        body: { page: 1, limit: 50 },
      });
      if (error) throw error;
      setRecords(data?.generations || []);
    } catch (e: any) {
      console.error("Error fetching video history:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!collapsed) fetchHistory();
  }, [collapsed, refreshTrigger, fetchHistory]);

  const makePermanent = async (record: VideoGenRecord) => {
    setActionLoading(record.id);
    try {
      const { error } = await supabase.functions.invoke("manage-ai-video-generation", {
        body: { action: "make_permanent", generationId: record.id },
      });
      if (error) throw error;
      setRecords((prev) =>
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
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
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

  if (collapsed) {
    return (
      <div
        className="w-10 shrink-0 border-l border-white/10 flex flex-col items-center py-3 gap-2"
        style={{ backgroundColor: "hsl(222, 47%, 11%)" }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        <div className="w-6 h-6 rounded bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center">
          <Film className="h-3 w-3 text-white" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="w-72 shrink-0 border-l border-white/10 flex flex-col overflow-hidden text-white"
        style={{ backgroundColor: "hsl(222, 47%, 11%)" }}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center">
              <Film className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-bold text-white">Histórico</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchHistory}
              className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
              title="Atualizar"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-2">
          {loading && records.length === 0 && (
            <div className="flex items-center justify-center h-32 text-white/40">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!loading && records.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-white/40 text-center px-4">
              <Film className="h-8 w-8 mb-2 opacity-30" />
              <span className="text-[11px]">Nenhum vídeo gerado ainda</span>
              <span className="text-[10px] opacity-60 mt-1">Vídeos gerados aparecerão aqui automaticamente</span>
            </div>
          )}

          {records.map((record) => {
            const expiry = getExpiryInfo(record);
            const isLoading = actionLoading === record.id;

            return (
              <div
                key={record.id}
                className="rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 transition-colors"
              >
                {/* Thumbnail / Preview */}
                <div
                  className="relative aspect-video bg-black/40 cursor-pointer flex items-center justify-center group"
                  onClick={() => record.video_url && setPreviewVideo(record)}
                >
                  {record.thumbnail_url ? (
                    <img
                      src={record.thumbnail_url}
                      alt={record.prompt}
                      className="w-full h-full object-cover"
                    />
                  ) : record.status === "generating" ? (
                    <div className="flex flex-col items-center gap-1.5 text-blue-400">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-[9px]">Gerando...</span>
                    </div>
                  ) : record.status === "error" ? (
                    <div className="flex flex-col items-center gap-1 text-destructive/80">
                      <AlertCircle className="h-6 w-6" />
                      <span className="text-[9px]">Erro</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-white/30">
                      <Film className="h-6 w-6" />
                      <span className="text-[9px]">Sem preview</span>
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="absolute top-1 left-1">
                    {record.status === "completed" && (
                      <span className="bg-green-500/20 text-green-400 text-[8px] font-medium px-1.5 py-0.5 rounded-full border border-green-500/30">
                        <CheckCircle2 className="h-2 w-2 inline mr-0.5" />OK
                      </span>
                    )}
                    {record.status === "generating" && (
                      <span className="bg-blue-500/20 text-blue-400 text-[8px] font-medium px-1.5 py-0.5 rounded-full border border-blue-500/30">
                        Gerando
                      </span>
                    )}
                    {record.status === "error" && (
                      <span className="bg-red-500/20 text-red-400 text-[8px] font-medium px-1.5 py-0.5 rounded-full border border-red-500/30">
                        Erro
                      </span>
                    )}
                  </div>

                  {/* Duration + ratio */}
                  <div className="absolute top-1 right-1 flex gap-1">
                    <span className="bg-black/60 text-white/70 text-[8px] px-1 py-0.5 rounded">
                      {record.duration}s
                    </span>
                    <span className="bg-black/60 text-white/70 text-[8px] px-1 py-0.5 rounded">
                      {record.aspect_ratio}
                    </span>
                  </div>

                  {/* Play overlay */}
                  {record.video_url && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-90 transition-opacity" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="px-2.5 py-2">
                  <p className="text-[10px] text-white/80 line-clamp-2 leading-relaxed mb-1.5">
                    {record.prompt}
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] text-white/40">
                      {formatDistanceToNow(new Date(record.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-medium",
                        expiry.urgent ? "text-orange-400" : record.is_permanent ? "text-emerald-400" : "text-white/40"
                      )}
                    >
                      <Clock className="h-2 w-2 inline mr-0.5" />
                      {expiry.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    {record.video_url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreviewVideo(record)}
                        className="flex-1 h-6 text-[9px] gap-0.5 text-white/60 hover:text-white hover:bg-white/10"
                      >
                        <Play className="h-2.5 w-2.5" />
                        Ver
                      </Button>
                    )}
                    {record.video_url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadVideo(record)}
                        className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-white/10"
                        title="Baixar"
                      >
                        <Download className="h-2.5 w-2.5" />
                      </Button>
                    )}
                    {!record.is_permanent && record.status === "completed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmPermanent(record)}
                        disabled={isLoading}
                        className="h-6 w-6 p-0 text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-400/10"
                        title="Salvar permanentemente"
                      >
                        {isLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Lock className="h-2.5 w-2.5" />}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(record)}
                      disabled={isLoading}
                      className="h-6 w-6 p-0 text-white/40 hover:text-red-400 hover:bg-red-400/10"
                      title="Remover do histórico"
                    >
                      {isLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Permanent Save Confirm Dialog */}
      <Dialog open={!!confirmPermanent} onOpenChange={(o) => !o && setConfirmPermanent(null)}>
        <DialogContent className="max-w-sm bg-zinc-950 border-white/10 text-white">
          <DialogTitle className="text-base">Salvar permanentemente?</DialogTitle>
          <DialogDescription className="text-white/60 text-sm">
            Este vídeo não expirará mais. Vídeos permanentes não contam nos seus limites de geração.
          </DialogDescription>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmPermanent(null)}
              className="flex-1 border-white/20 text-white/70 hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => confirmPermanent && makePermanent(confirmPermanent)}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-medium"
            >
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              Salvar para sempre
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm bg-zinc-950 border-white/10 text-white">
          <DialogTitle className="text-base">Remover vídeo?</DialogTitle>
          <DialogDescription className="text-white/60 text-sm">
            O vídeo será removido do histórico permanentemente. Esta ação não pode ser desfeita.
          </DialogDescription>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(null)}
              className="flex-1 border-white/20 text-white/70 hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => confirmDelete && deleteRecord(confirmDelete)}
              className="flex-1"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Preview Dialog */}
      <Dialog open={!!previewVideo} onOpenChange={(o) => !o && setPreviewVideo(null)}>
        <DialogContent className="max-w-3xl bg-zinc-950 border-white/10 p-2">
          <DialogTitle className="sr-only">Preview do Vídeo</DialogTitle>
          {previewVideo?.video_url && (
            <div className="flex flex-col gap-3 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90 line-clamp-1">{previewVideo.prompt}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadVideo(previewVideo)}
                  className="gap-1.5 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar
                </Button>
              </div>
              <video
                src={previewVideo.video_url}
                controls
                autoPlay
                className="w-full rounded-lg bg-black max-h-[65vh]"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
