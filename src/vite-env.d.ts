/// <reference types="vite/client" />

interface Window {
  __activeUploadToast?: {
    id: string;
    totalFiles: number;
    completedFiles: number;
    startTime: number;
    update: (props: { 
      id: string; 
      title?: string; 
      description?: string; 
      duration?: number;
      icon?: React.ReactNode;
    }) => void;
    dismiss: () => void;
  } | null;
}
