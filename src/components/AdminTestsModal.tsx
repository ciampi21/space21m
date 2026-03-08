import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { R2HealthChecker } from '@/components/R2HealthChecker';
import { R2FileUploadTest } from '@/components/R2FileUploadTest';
import { R2StatusSummary } from '@/components/R2StatusSummary';
import { FlaskConical, Upload, Activity } from 'lucide-react';

interface AdminTestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AdminTestsModal: React.FC<AdminTestsModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            {t('admin.systemTests', 'System Tests')}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="health" className="h-full overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t('admin.healthCheck', 'Health Check')}
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t('admin.uploadTest', 'Upload Test')}
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              {t('admin.statusSummary', 'Status Summary')}
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-4 h-[calc(90vh-120px)] overflow-y-auto">
            <TabsContent value="health" className="mt-0">
              <R2HealthChecker />
            </TabsContent>
            
            <TabsContent value="upload" className="mt-0">
              <R2FileUploadTest />
            </TabsContent>
            
            <TabsContent value="status" className="mt-0">
              <R2StatusSummary />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};