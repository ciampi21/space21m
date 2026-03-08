import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { testR2Connection, testR2FullFunctionality } from '@/lib/cloudflareR2';
import { CheckCircle, XCircle, AlertCircle, Cloud, Database, Upload } from 'lucide-react';

interface R2Status {
  config: 'checking' | 'valid' | 'invalid';
  upload: 'checking' | 'working' | 'failed';
  lastCheck?: Date;
  customDomain?: string | null;
  usingCustomDomain?: boolean;
}

export const R2StatusSummary: React.FC = () => {
  const [status, setStatus] = useState<R2Status>({ config: 'checking', upload: 'checking' });

  const checkR2Status = async () => {
    try {
      // Test configuration
      const configTest = await testR2Connection();
      
      // Test upload functionality
      const uploadTest = await testR2FullFunctionality();
      
      console.log('Config test details:', configTest.details);
      console.log('Upload test details:', uploadTest.details);
      
      setStatus({
        config: configTest.success ? 'valid' : 'invalid',
        upload: uploadTest.success ? 'working' : 'failed',
        lastCheck: new Date(),
        customDomain: configTest.details?.customDomain || null,
        usingCustomDomain: configTest.details?.usingCustomDomain || false
      });
      
    } catch (error) {
      console.error('Error checking R2 status:', error);
      setStatus({
        config: 'invalid',
        upload: 'failed',
        lastCheck: new Date(),
        customDomain: null,
        usingCustomDomain: false
      });
    }
  };

  useEffect(() => {
    checkR2Status();
  }, []);

  const getConfigStatusIcon = () => {
    switch (status.config) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getUploadStatusIcon = () => {
    switch (status.upload) {
      case 'working':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getOverallStatus = () => {
    if (status.config === 'valid' && status.upload === 'working') {
      return { text: 'Sistema R2 Operacional', color: 'default' as const };
    } else if (status.config === 'invalid' || status.upload === 'failed') {
      return { text: 'Sistema R2 com Problemas', color: 'destructive' as const };
    } else {
      return { text: 'Verificando Sistema R2', color: 'secondary' as const };
    }
  };

  const overallStatus = getOverallStatus();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            <CardTitle className="text-lg">Status R2 Storage</CardTitle>
          </div>
          <Badge variant={overallStatus.color}>
            {overallStatus.text}
          </Badge>
        </div>
        <CardDescription>
          Status do sistema de armazenamento Cloudflare R2
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            {getConfigStatusIcon()}
            <div>
              <p className="font-medium">Configuração</p>
              <p className="text-sm text-muted-foreground">
                {status.config === 'valid' ? 'Secrets configurados corretamente' :
                 status.config === 'invalid' ? 'Secrets incompletos ou inválidos' :
                 'Verificando configuração...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            {getUploadStatusIcon()}
            <div>
              <p className="font-medium">Funcionalidade</p>
              <p className="text-sm text-muted-foreground">
                {status.upload === 'working' ? 'Uploads funcionando normalmente' :
                 status.upload === 'failed' ? 'Problemas com uploads' :
                 'Testando uploads...'}
              </p>
            </div>
          </div>
        </div>
        
        {status.usingCustomDomain && status.customDomain && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <p className="font-medium text-blue-900 dark:text-blue-100">Custom Domain Ativo</p>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              URLs utilizando: {status.customDomain}
            </p>
          </div>
        )}
        
        {status.lastCheck && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              Última verificação: {status.lastCheck.toLocaleTimeString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};