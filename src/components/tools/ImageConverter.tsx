import { useState, useCallback } from "react";
import { Upload, Download, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { convertImage, formatFileSize, type ImageFormat, type ConvertedImage } from "@/lib/converters/imageConverter";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'converting' | 'done' | 'error';
  converted?: ConvertedImage;
  error?: string;
}

const ImageConverter = () => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [format, setFormat] = useState<ImageFormat>('image/jpeg');
  const [quality, setQuality] = useState([90]);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const newImages: ImageFile[] = Array.from(files).map(file => ({
      id: Math.random().toString(36),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));

    setImages(prev => [...prev, ...newImages]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const removeImage = (id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image) URL.revokeObjectURL(image.preview);
      return prev.filter(img => img.id !== id);
    });
  };

  const convertImages = async () => {
    if (images.length === 0) {
      toast.error("Adicione pelo menos uma imagem");
      return;
    }

    setConverting(true);
    setProgress(0);

    const total = images.length;
    let completed = 0;

    for (const image of images) {
      try {
        setImages(prev =>
          prev.map(img =>
            img.id === image.id ? { ...img, status: 'converting' as const } : img
          )
        );

        const converted = await convertImage(image.file, {
          format,
          quality: quality[0] / 100,
        });

        setImages(prev =>
          prev.map(img =>
            img.id === image.id
              ? { ...img, status: 'done' as const, converted }
              : img
          )
        );

        completed++;
        setProgress((completed / total) * 100);
      } catch (error) {
        console.error('Conversion error:', error);
        setImages(prev =>
          prev.map(img =>
            img.id === image.id
              ? {
                  ...img,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : 'Erro desconhecido',
                }
              : img
          )
        );
        completed++;
        setProgress((completed / total) * 100);
      }
    }

    setConverting(false);
    toast.success(`${images.filter(img => img.status === 'done').length} imagens convertidas!`);
  };

  const downloadSingle = (image: ImageFile) => {
    if (!image.converted) return;
    saveAs(image.converted.file);
  };

  const downloadAll = async () => {
    const convertedImages = images.filter(img => img.converted);
    
    if (convertedImages.length === 0) {
      toast.error("Nenhuma imagem convertida para baixar");
      return;
    }

    if (convertedImages.length === 1) {
      downloadSingle(convertedImages[0]);
      return;
    }

    const zip = new JSZip();
    convertedImages.forEach(img => {
      if (img.converted) {
        zip.file(img.converted.file.name, img.converted.file);
      }
    });

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "imagens-convertidas.zip");
    toast.success("Download iniciado!");
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setProgress(0);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
        onClick={() => document.getElementById('image-input')?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">Arraste imagens ou clique para selecionar</p>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WEBP, GIF, BMP, TIFF, SVG
        </p>
        <input
          id="image-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Settings */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Formato de Saída</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ImageFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image/jpeg">JPEG</SelectItem>
                <SelectItem value="image/png">PNG</SelectItem>
                <SelectItem value="image/webp">WEBP</SelectItem>
                <SelectItem value="image/gif">GIF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(format === 'image/jpeg' || format === 'image/webp') && (
            <div className="space-y-1.5">
              <Label className="text-sm">Qualidade: {quality[0]}%</Label>
              <Slider
                value={quality}
                onValueChange={setQuality}
                min={1}
                max={100}
                step={1}
              />
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {converting && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Convertendo...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {/* Image List */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">{images.length} imagem(ns)</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearAll}>
                Limpar
              </Button>
              <Button size="sm" onClick={convertImages} disabled={converting}>
                Converter
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map(image => (
              <div key={image.id} className="border rounded-lg p-2 space-y-1.5">
                <div className="relative aspect-square bg-muted rounded overflow-hidden">
                  <img
                    src={image.preview}
                    alt={image.file.name}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 bg-background/80 hover:bg-background"
                    onClick={() => removeImage(image.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-0.5">
                  <p className="text-xs font-medium truncate">{image.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(image.file.size)}
                  </p>

                  {image.status === 'done' && image.converted && (
                    <>
                      <p className="text-xs text-green-600">
                        ✓ Convertido: {formatFileSize(image.converted.convertedSize)}
                        {image.converted.convertedSize < image.converted.originalSize && (
                          <span className="ml-1">
                            (-{Math.round((1 - image.converted.convertedSize / image.converted.originalSize) * 100)}%)
                          </span>
                        )}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => downloadSingle(image)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar
                      </Button>
                    </>
                  )}

                  {image.status === 'error' && (
                    <p className="text-xs text-destructive">✗ {image.error}</p>
                  )}

                  {image.status === 'converting' && (
                    <p className="text-xs text-primary">⏳ Convertendo...</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {images.some(img => img.status === 'done') && (
            <Button size="sm" onClick={downloadAll} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Baixar Todas {images.filter(img => img.status === 'done').length > 1 ? '(ZIP)' : ''}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageConverter;
