import { useState } from "react";
import { Upload, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AudioConverter = () => {
  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          O conversor de áudio requer FFmpeg.wasm e será implementado em breve.
          Esta ferramenta permitirá converter entre MP3, WAV, OGG, AAC e FLAC.
        </AlertDescription>
      </Alert>

      <div
        className="border-2 border-dashed rounded-lg p-12 text-center bg-muted/50"
      >
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">Em Desenvolvimento</p>
        <p className="text-sm text-muted-foreground">
          Conversor de áudio chegando em breve
        </p>
      </div>
    </div>
  );
};

export default AudioConverter;
