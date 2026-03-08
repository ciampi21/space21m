import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

export type VideoFormat = 'mp4' | 'webm' | 'mov';
export type VideoQuality = 'low' | 'medium' | 'high';

export interface VideoConversionOptions {
  format: VideoFormat;
  quality: VideoQuality;
}

export interface ConvertedVideo {
  blob: Blob;
  name: string;
  originalName: string;
  originalSize: number;
  convertedSize: number;
  originalFormat: string;
  convertedFormat: string;
}

export interface ConversionProgress {
  percent: number;
  time?: number;
  speed?: string;
}

let ffmpeg: FFmpeg | null = null;
let isLoading = false;

const FFMPEG_CORE_VERSION = '0.12.10';
const BASE_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

export const isFFmpegLoaded = (): boolean => {
  return ffmpeg !== null && ffmpeg.loaded;
};

export const loadFFmpeg = async (
  onProgress?: (progress: number) => void
): Promise<FFmpeg> => {
  if (ffmpeg && ffmpeg.loaded) {
    return ffmpeg;
  }

  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (ffmpeg && ffmpeg.loaded) {
      return ffmpeg;
    }
  }

  isLoading = true;

  try {
    ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    // Load FFmpeg core from CDN
    const coreURL = await toBlobURL(
      `${BASE_URL}/ffmpeg-core.js`,
      'text/javascript'
    );
    
    const wasmURL = await toBlobURL(
      `${BASE_URL}/ffmpeg-core.wasm`,
      'application/wasm'
    );

    onProgress?.(50);

    await ffmpeg.load({
      coreURL,
      wasmURL,
    });

    onProgress?.(100);
    
    console.log('[FFmpeg] Loaded successfully');
    return ffmpeg;
  } catch (error) {
    console.error('[FFmpeg] Failed to load:', error);
    ffmpeg = null;
    throw new Error('Falha ao carregar FFmpeg. Tente novamente.');
  } finally {
    isLoading = false;
  }
};

const getOutputExtension = (format: VideoFormat): string => {
  return format;
};

const getFFmpegArgs = (format: VideoFormat, quality: VideoQuality): string[] => {
  // CRF values: lower = better quality, higher file size
  const crfMap: Record<VideoQuality, number> = {
    low: 32,
    medium: 26,
    high: 20,
  };
  
  const crf = crfMap[quality];

  switch (format) {
    case 'mp4':
      return ['-c:v', 'libx264', '-preset', 'fast', '-crf', crf.toString(), '-c:a', 'aac', '-b:a', '128k'];
    case 'webm':
      return ['-c:v', 'libvpx', '-crf', crf.toString(), '-b:v', '0', '-c:a', 'libvorbis', '-q:a', '4'];
    case 'mov':
      return ['-c:v', 'libx264', '-preset', 'fast', '-crf', crf.toString(), '-c:a', 'aac', '-b:a', '128k'];
    default:
      return ['-c:v', 'libx264', '-preset', 'fast', '-crf', crf.toString(), '-c:a', 'aac', '-b:a', '128k'];
  }
};

const getInputFormat = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ext;
};

export const convertVideo = async (
  file: File,
  options: VideoConversionOptions,
  onProgress?: (progress: ConversionProgress) => void
): Promise<ConvertedVideo> => {
  const ffmpegInstance = await loadFFmpeg();

  const inputName = `input.${getInputFormat(file.name)}`;
  const outputExt = getOutputExtension(options.format);
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const outputName = `output.${outputExt}`;
  const finalName = `${baseName}.${outputExt}`;

  // Set up progress handler
  ffmpegInstance.on('progress', ({ progress, time }) => {
    onProgress?.({
      percent: Math.round(progress * 100),
      time: time,
    });
  });

  try {
    // Write input file to FFmpeg virtual filesystem
    const inputData = await fetchFile(file);
    await ffmpegInstance.writeFile(inputName, inputData);

    // Get FFmpeg arguments for the selected format and quality
    const args = getFFmpegArgs(options.format, options.quality);

    // Run FFmpeg conversion
    await ffmpegInstance.exec([
      '-i', inputName,
      ...args,
      '-y', // Overwrite output
      outputName
    ]);

    // Read output file
    const outputData = await ffmpegInstance.readFile(outputName);
    
    // Create blob from output
    const mimeTypes: Record<VideoFormat, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
    };
    
    // Create a new Uint8Array copy to avoid SharedArrayBuffer issues
    const uint8Array = new Uint8Array(outputData as Uint8Array);
    const blob = new Blob([uint8Array], { type: mimeTypes[options.format] });

    // Cleanup
    await ffmpegInstance.deleteFile(inputName);
    await ffmpegInstance.deleteFile(outputName);

    return {
      blob,
      name: finalName,
      originalName: file.name,
      originalSize: file.size,
      convertedSize: blob.size,
      originalFormat: getInputFormat(file.name),
      convertedFormat: options.format,
    };
  } catch (error) {
    console.error('[FFmpeg] Conversion error:', error);
    throw new Error('Falha na conversão do vídeo. O formato pode não ser suportado.');
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
