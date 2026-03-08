import React from 'react';
import { Button } from '@/components/ui/button';
import { X, ImageIcon, FileVideo, Play, GripVertical } from 'lucide-react';
import { normalizeMediaUrl } from '@/lib/utils';
import { isVideoFile } from '@/lib/videoThumbnails';

interface DraggableMediaGridProps {
  files: File[];
  thumbnails: Record<string, string>;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export const DraggableMediaGrid: React.FC<DraggableMediaGridProps> = ({
  files,
  thumbnails,
  onRemove,
  onReorder
}) => {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorder(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="grid grid-cols-4 gap-3">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className={`relative group cursor-move ${
            dragOverIndex === index ? 'ring-2 ring-primary ring-offset-2' : ''
          } ${draggedIndex === index ? 'opacity-50' : ''}`}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
        >
          <div className="h-16 w-24 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
            {file.type.startsWith('image/') ? (
              <div className="relative w-full h-full">
                <img 
                  src={URL.createObjectURL(file)} 
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-1 bg-black/70 rounded px-1">
                  <ImageIcon className="h-3 w-3 text-white" />
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <img
                  src={thumbnails[file.name] || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik04IDV2MTRsOS03LTlMN3oiIGZpbGw9IiM2Mzc1OGYiLz4KPC9zdmc+'}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/50 rounded-full p-1">
                    <Play className="h-3 w-3 text-white fill-white" />
                  </div>
                </div>
                <div className="absolute bottom-1 left-1 bg-black/70 rounded px-1">
                  <FileVideo className="h-3 w-3 text-white" />
                </div>
              </div>
            )}
            
            {/* Drag handle */}
            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-black/70 rounded p-1">
                <GripVertical className="h-3 w-3 text-white" />
              </div>
            </div>

            {/* Remove button */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

interface DraggableExistingMediaGridProps {
  mediaUrls: string[];
  thumbnails: Record<string, string>;
  savedThumbnails?: string[];
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export const DraggableExistingMediaGrid: React.FC<DraggableExistingMediaGridProps> = ({
  mediaUrls,
  thumbnails,
  savedThumbnails = [],
  onRemove,
  onReorder
}) => {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorder(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const isVideo = (url: string): boolean => {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv'];
    const urlLower = url.toLowerCase();
    return videoExtensions.some(ext => urlLower.includes(ext)) || url.includes('video');
  };

  const getThumbnailForMedia = (url: string, index: number): string => {
    console.log(`🎯 Getting thumbnail for URL: ${url} at index ${index}`);
    console.log(`📁 Saved thumbnails:`, savedThumbnails);
    console.log(`🎬 Generated thumbnails:`, thumbnails);
    
    // Priority 1: Use saved thumbnail from post
    if (savedThumbnails && savedThumbnails[index]) {
      const normalizedThumbnail = normalizeMediaUrl(savedThumbnails[index]);
      console.log(`✅ Using saved thumbnail: ${normalizedThumbnail}`);
      return normalizedThumbnail;
    }
    
    // Priority 2: Use dynamically generated thumbnail
    const normalizedUrl = normalizeMediaUrl(url);
    if (isVideo(normalizedUrl) && thumbnails[normalizedUrl]) {
      console.log(`✅ Using generated thumbnail: ${thumbnails[normalizedUrl]}`);
      return thumbnails[normalizedUrl];
    }
    
    // Priority 3: For videos without thumbnails, return the fallback SVG
    if (isVideo(normalizedUrl)) {
      console.log(`⚡ Using fallback SVG for video`);
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik04IDV2MTRsOS03LTlMN3oiIGZpbGw9IiM2Mzc1OGYiLz4KPC9zdmc+';
    }
    
    // For images, return original URL
    console.log(`🖼️ Using original image URL`);
    return normalizedUrl;
  };

  return (
    <div className="grid grid-cols-4 gap-3">
      {mediaUrls.map((url, index) => (
        <div
          key={`${url}-${index}`}
          className={`relative group cursor-move ${
            dragOverIndex === index ? 'ring-2 ring-primary ring-offset-2' : ''
          } ${draggedIndex === index ? 'opacity-50' : ''}`}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
        >
          <div className="h-16 w-24 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
            {isVideo(url) ? (
              <div className="relative w-full h-full">
                <img
                  src={getThumbnailForMedia(url, index)}
                  alt={`Existing media ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/50 rounded-full p-1">
                    <Play className="h-3 w-3 text-white fill-white" />
                  </div>
                </div>
                <div className="absolute bottom-1 left-1 bg-black/70 rounded px-1">
                  <FileVideo className="h-3 w-3 text-white" />
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <img 
                  src={url} 
                  alt={`Existing media ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-1 bg-black/70 rounded px-1">
                  <ImageIcon className="h-3 w-3 text-white" />
                </div>
              </div>
            )}
            
            {/* Drag handle */}
            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-black/70 rounded p-1">
                <GripVertical className="h-3 w-3 text-white" />
              </div>
            </div>

            {/* Remove button */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};