import { supabase } from "@/integrations/supabase/client";

export async function executeThumbnailRecovery(): Promise<{success: boolean, message: string}> {
  try {
    console.log('🔄 Iniciando recuperação de thumbnails...');
    
    const { data, error } = await supabase.functions.invoke('recover-thumbnails', {
      body: { 
        manual_trigger: true,
        timestamp: new Date().toISOString()
      }
    });

    if (error) {
      console.error('❌ Erro ao executar recuperação:', error);
      return {
        success: false,
        message: `Erro: ${error.message}`
      };
    }

    console.log('✅ Recuperação executada:', data);
    return {
      success: true,
      message: data?.message || 'Recuperação executada com sucesso'
    };
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return {
      success: false,
      message: `Erro inesperado: ${error}`
    };
  }
}