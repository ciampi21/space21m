import { useState, useCallback, useRef } from "react";
import { Upload, Video, Download, Loader2, Trash2, AlertCircle, CheckCircle2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  loadFFmpeg,
  convertVideo,
  isFFmpegLoaded,
  formatFileSize,
  type VideoFormat,
  type VideoQuality,
  type ConvertedVideo,
  type ConversionProgress,
} from "@/lib/converters/videoConverter";

const ACCEPTED_FORMATS = ".mp4,.webm,.mov,.avi,.mkv,.m4v,.wmv,.flv";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

interface VideoFile {
  file: File;
  preview: string;
  duration?: number;
}

const VideoConverter = () => {
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [outputFormat, setOutputFormat] = useState<VideoFormat>("mp4");
  const [quality, setQuality] = useState<VideoQuality>("medium");
  const [isLoadingFFmpeg, setIsLoadingFFmpeg] = useState(false);
  const [ffmpegLoadProgress, setFfmpegLoadProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState<ConversionProgress>({ percent: 0 });
  const [convertedVideo, setConvertedVideo] = useState<ConvertedVideo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    setError(null);
    setConvertedVideo(null);

    if (file.size > MAX_FILE_SIZE) {
      setError(`Arquivo muito grande. Máximo: ${formatFileSize(MAX_FILE_SIZE)}`);
      return;
    }

    const preview = URL.createObjectURL(file);
    setVideoFile({ file, preview });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      handleFileSelect(file);
    } else {
      setError("Por favor, selecione um arquivo de vídeo válido.");
    }
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleLoadFFmpeg = async () => {
    setIsLoadingFFmpeg(true);
    setError(null);
    setFfmpegLoadProgress(0);

    try {
      await loadFFmpeg((progress) => {
        setFfmpegLoadProgress(progress);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar FFmpeg");
    } finally {
      setIsLoadingFFmpeg(false);
    }
  };

  const handleConvert = async () => {
    if (!videoFile) return;

    // Load FFmpeg if not already loaded
    if (!isFFmpegLoaded()) {
      await handleLoadFFmpeg();
      if (!isFFmpegLoaded()) return;
    }

    setIsConverting(true);
    setConversionProgress({ percent: 0 });
    setError(null);
    setConvertedVideo(null);

    try {
      const result = await convertVideo(
        videoFile.file,
        { format: outputFormat, quality },
        (progress) => {
          setConversionProgress(progress);
        }
      );
      setConvertedVideo(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na conversão");
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!convertedVideo) return;

    const url = URL.createObjectURL(convertedVideo.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = convertedVideo.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (videoFile?.preview) {
      URL.revokeObjectURL(videoFile.preview);
    }
    setVideoFile(null);
    setConvertedVideo(null);
    setConversionProgress({ percent: 0 });
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current) {
      setVideoFile(prev => prev ? {
        ...prev,
        duration: videoRef.current?.duration
      } : null);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* FFmpeg Loading State */}
      {isLoadingFFmpeg && (
        <Alert className="border-primary/20 bg-primary/5">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <AlertDescription>
            <div className="space-y-2">
              <span>Preparando conversor... {ffmpegLoadProgress}%</span>
              <Progress value={ffmpegLoadProgress} className="h-2" />
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Area */}
      {!videoFile && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? "border-primary bg-primary/5 scale-[1.02]" 
              : "border-border hover:border-primary/50 hover:bg-muted/50"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FORMATS}
            onChange={handleInputChange}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium mb-1">
                Arraste um vídeo ou clique para selecionar
              </p>
              <p className="text-sm text-muted-foreground">
                MP4, WebM, MOV, AVI, MKV • Máx. 500MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Video Preview */}
      {videoFile && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-black/5 border">
            <video
              ref={videoRef}
              src={videoFile.preview}
              onLoadedMetadata={handleVideoLoad}
              controls
              className="w-full max-h-[300px] object-contain"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="absolute top-2 right-2 bg-background/80 hover:bg-background"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              <Video className="h-3 w-3 mr-1" />
              {videoFile.file.name}
            </Badge>
            <Badge variant="outline">
              {formatFileSize(videoFile.file.size)}
            </Badge>
            {videoFile.duration && (
              <Badge variant="outline">
                {formatDuration(videoFile.duration)}
              </Badge>
            )}
          </div>

          {/* Conversion Options */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="format">Formato de saída</Label>
              <Select
                value={outputFormat}
                onValueChange={(v) => setOutputFormat(v as VideoFormat)}
                disabled={isConverting}
              >
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp4">MP4 (H.264)</SelectItem>
                  <SelectItem value="webm">WebM (VP8)</SelectItem>
                  <SelectItem value="mov">MOV (H.264)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quality">Qualidade</Label>
              <Select
                value={quality}
                onValueChange={(v) => setQuality(v as VideoQuality)}
                disabled={isConverting}
              >
                <SelectTrigger id="quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa (menor arquivo)</SelectItem>
                  <SelectItem value="medium">Média (balanceado)</SelectItem>
                  <SelectItem value="high">Alta (melhor qualidade)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conversion Progress */}
          {isConverting && (
            <div className="space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Convertendo...
                </span>
                <span className="font-medium">{conversionProgress.percent}%</span>
              </div>
              <Progress value={conversionProgress.percent} className="h-2" />
            </div>
          )}

          {/* Converted Result */}
          {convertedVideo && (
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">
                      Conversão concluída!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(convertedVideo.originalSize)} → {formatFileSize(convertedVideo.convertedSize)}
                      {convertedVideo.convertedSize < convertedVideo.originalSize && (
                        <span className="text-green-600 ml-1">
                          (-{Math.round((1 - convertedVideo.convertedSize / convertedVideo.originalSize) * 100)}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Button onClick={handleDownload} className="gap-2">
                  <Download className="h-4 w-4" />
                  Baixar
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!convertedVideo && (
            <div className="flex gap-3">
              <Button
                onClick={handleConvert}
                disabled={isConverting || isLoadingFFmpeg}
                className="flex-1 gap-2"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Convertendo...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    Converter para {outputFormat.toUpperCase()}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoConverter;
