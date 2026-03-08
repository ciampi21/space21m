export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export interface ConversionOptions {
  format: ImageFormat;
  quality?: number; // 0-1 for jpeg/webp
  maxWidth?: number;
  maxHeight?: number;
}

export interface ConvertedImage {
  file: File;
  originalSize: number;
  convertedSize: number;
  originalFormat: string;
  convertedFormat: string;
}

const getFileExtension = (mimeType: ImageFormat): string => {
  const extensions: Record<ImageFormat, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return extensions[mimeType] || 'jpg';
};

export const convertImage = async (
  file: File,
  options: ConversionOptions
): Promise<ConvertedImage> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      try {
        // Calculate dimensions
        let width = img.width;
        let height = img.height;

        if (options.maxWidth && width > options.maxWidth) {
          height = (height * options.maxWidth) / width;
          width = options.maxWidth;
        }

        if (options.maxHeight && height > options.maxHeight) {
          width = (width * options.maxHeight) / height;
          height = options.maxHeight;
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to convert image'));
              return;
            }

            const extension = getFileExtension(options.format);
            const fileName = file.name.replace(/\.[^/.]+$/, '') + '.' + extension;
            const convertedFile = new File([blob], fileName, { type: options.format });

            resolve({
              file: convertedFile,
              originalSize: file.size,
              convertedSize: blob.size,
              originalFormat: file.type,
              convertedFormat: options.format,
            });
          },
          options.format,
          options.quality || 0.9
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
