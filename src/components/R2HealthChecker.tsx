import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Loader2, TestTube, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface HealthCheckResult {
  success: boolean;
  message: string;
  details?: any;
  timestamp: string;
}

export const R2HealthChecker: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<HealthCheckResult | null>(null);

  const testR2Connection = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      console.log('Testing R2 connection via test-r2-connection edge function...');
      
      // Test using the dedicated test-r2-connection function
      const { data, error } = await supabase.functions.invoke('test-r2-connection', {
        method: 'GET'
      });

      if (error) {
        console.error('R2 connection test failed:', error);
        setResult({
          success: false,
          message: 'Falha na conexão R2',
          details: error,
          timestamp: new Date().toISOString()
        });
        toast.error('Teste de conexão R2 falhou');
        return;
      }

      console.log('R2 connection test result:', data);
      setResult({
        success: true,
        message: 'Conexão R2 funcionando',
        details: data,
        timestamp: new Date().toISOString()
      });
      toast.success('Conexão R2 testada com sucesso!');
      
    } catch (err: any) {
      console.error('Error testing R2 connection:', err);
      setResult({
        success: false,
        message: 'Erro no teste de conexão',
        details: err.message,
        timestamp: new Date().toISOString()
      });
      toast.error('Erro ao testar conexão R2');
    } finally {
      setIsLoading(false);
    }
  };

  const testFullR2Functionality = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      console.log('Testing R2 full functionality (upload + delete test)...');
      
      const { data, error } = await supabase.functions.invoke('r2-full-test', {
        method: 'GET'
      });

      if (error) {
        console.error('R2 full test failed:', error);
        setResult({
          success: false,
          message: 'Teste completo R2 falhou',
          details: error,
          timestamp: new Date().toISOString()
        });
        toast.error('Teste completo R2 falhou');
        return;
      }

      console.log('R2 full test result:', data);
      setResult({
        success: data.success,
        message: data.message,
        details: data.details || data,
        timestamp: new Date().toISOString()
      });
      
      if (data.success) {
        toast.success('Teste completo R2 passou!');
      } else {
        toast.error('Teste completo R2 falhou');
      }
      
    } catch (err: any) {
      console.error('Error in R2 full test:', err);
      setResult({
        success: false,
        message: 'Erro no teste completo',
        details: err.message,
        timestamp: new Date().toISOString()
      });
      toast.error('Erro no teste completo R2');
    } finally {
      setIsLoading(false);
    }
  };

  const testUploadEndpointHealth = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      console.log('Testing R2 upload endpoint health check...');
      
      // Test the health check endpoint within upload-to-r2 function
      const response = await fetch(
        `https://lqbpqecybxdylqjedwza.supabase.co/functions/v1/upload-to-r2?health_check=true`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Upload endpoint health check failed:', data);
        setResult({
          success: false,
          message: 'Health check do upload falhou',
          details: data,
          timestamp: new Date().toISOString()
        });
        toast.error('Health check falhou');
        return;
      }

      console.log('Upload endpoint health check result:', data);
      setResult({
        success: true,
        message: 'Upload endpoint saudável',
        details: data,
        timestamp: new Date().toISOString()
      });
      toast.success('Health check passou!');
      
    } catch (err: any) {
      console.error('Error in upload endpoint health check:', err);
      setResult({
        success: false,
        message: 'Erro no health check',
        details: err.message,
        timestamp: new Date().toISOString()
      });
      toast.error('Erro no health check');
    } finally {
      setIsLoading(false);
    }
  };

  const debugEnvVars = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      console.log('Running environment variables debug...');
      
      const { data, error } = await supabase.functions.invoke('debug-env-vars');

      if (error) {
        console.error('Environment variables debug failed:', error);
        setResult({
          success: false,
          message: 'Debug das variáveis falhou',
          details: error,
          timestamp: new Date().toISOString()
        });
        toast.error('Debug das variáveis falhou');
        return;
      }

      console.log('Environment variables debug result:', data);
      setResult({
        success: true,
        message: 'Debug das variáveis concluído',
        details: data,
        timestamp: new Date().toISOString()
      });
      toast.success('Debug das variáveis concluído!');
      
    } catch (err: any) {
      console.error('Error debugging environment variables:', err);
      setResult({
        success: false,
        message: 'Erro no debug das variáveis',
        details: err.message,
        timestamp: new Date().toISOString()
      });
      toast.error('Erro no debug das variáveis');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerMediaCleanup = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      console.log('Triggering manual media cleanup...');
      
      const { data, error } = await supabase.rpc('trigger_media_cleanup');

      if (error) {
        console.error('Media cleanup failed:', error);
        setResult({
          success: false,
          message: 'Limpeza de mídia falhou',
          details: error,
          timestamp: new Date().toISOString()
        });
        toast.error('Limpeza de mídia falhou');
        return;
      }

      console.log('Media cleanup result:', data);
      setResult({
        success: true,
        message: 'Limpeza de mídia executada com sucesso',
        details: { message: 'Cleanup triggered successfully' },
        timestamp: new Date().toISOString()
      });
      toast.success('Limpeza de mídia executada!');
      
    } catch (err: any) {
      console.error('Error triggering media cleanup:', err);
      setResult({
        success: false,
        message: 'Erro na limpeza de mídia',
        details: err.message,
        timestamp: new Date().toISOString()
      });
      toast.error('Erro na limpeza de mídia');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          R2 Storage Health Check
        </CardTitle>
        <CardDescription>
          Teste a conectividade com o Cloudflare R2 storage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Button 
            onClick={testR2Connection}
            disabled={isLoading}
            variant="outline"
            className="justify-start"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Teste Configuração
          </Button>
          
          <Button 
            onClick={testFullR2Functionality}
            disabled={isLoading}
            variant="default"
            className="justify-start"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Teste Completo (Upload)
          </Button>

          <Button 
            onClick={testUploadEndpointHealth}
            disabled={isLoading}
            variant="outline"
            className="justify-start"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Health Check Upload
          </Button>

          <Button 
            onClick={debugEnvVars}
            disabled={isLoading}
            variant="secondary"
            className="justify-start"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Debug Env Vars
          </Button>

          <Button 
            onClick={triggerMediaCleanup}
            disabled={isLoading}
            variant="destructive"
            className="justify-start md:col-span-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Limpeza Manual de Mídia
          </Button>
        </div>

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <Badge variant={result.success ? "default" : "destructive"}>
                {result.success ? "SUCESSO" : "FALHA"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {new Date(result.timestamp).toLocaleTimeString()}
              </span>
            </div>
            
            <div className="space-y-2">
              <p className="font-medium">{result.message}</p>
              
              {result.details && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Detalhes:</p>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};