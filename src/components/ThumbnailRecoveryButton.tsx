import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { executeThumbnailRecovery } from "@/utils/thumbnailRecovery";

export function ThumbnailRecoveryButton() {
  const [isRecovering, setIsRecovering] = useState(false);

  const handleRecovery = async () => {
    setIsRecovering(true);
    toast.info("Iniciando recuperação de thumbnails...");
    
    try {
      const result = await executeThumbnailRecovery();
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Erro ao executar recuperação de thumbnails");
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <Button 
      onClick={handleRecovery} 
      disabled={isRecovering}
      variant="outline"
    >
      {isRecovering ? "Recuperando..." : "Recuperar Thumbnails"}
    </Button>
  );
}