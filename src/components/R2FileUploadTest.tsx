import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { uploadToCloudflareR2 } from '@/lib/cloudflareR2';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContextNew';
import { Upload, CheckCircle, XCircle, Loader2, File } from 'lucide-react';
import { toast } from 'sonner';

interface UploadTestResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
  duration?: number;
  fileSize?: number;
}

export const R2FileUploadTest: React.FC = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<UploadTestResult | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user || !currentWorkspace) {
      toast.error('Missing file, user or workspace');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setResult(null);

    const startTime = Date.now();

    try {
      console.log('Starting test upload:', {
        file: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        workspace: currentWorkspace.id,
        user: user.id
      });

      setUploadProgress(30);

      // Upload the file
      const uploadResult = await uploadToCloudflareR2(
        selectedFile,
        currentWorkspace.id,
        user.id,
        2 // 2 retries
      );

      const duration = Date.now() - startTime;
      setUploadProgress(100);

      if (uploadResult.error) {
        console.error('Upload failed:', uploadResult.error);
        setResult({
          success: false,
          error: uploadResult.error,
          duration,
          fileSize: selectedFile.size
        });
        toast.error('Upload failed: ' + uploadResult.error);
      } else {
        console.log('Upload successful:', uploadResult);
        setResult({
          success: true,
          url: uploadResult.url,
          key: uploadResult.key,
          duration,
          fileSize: selectedFile.size
        });
        toast.success('Upload completed successfully!');
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Upload error:', error);
      setResult({
        success: false,
        error: error.message || 'Unknown error',
        duration,
        fileSize: selectedFile.size
      });
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (!user || !currentWorkspace) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            Please select a workspace and ensure you're logged in to test file uploads.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          R2 File Upload Test
        </CardTitle>
        <CardDescription>
          Test file uploads to Cloudflare R2 storage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file-input">Select a file to upload</Label>
          <Input
            id="file-input"
            type="file"
            onChange={handleFileSelect}
            disabled={isUploading}
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          />
          {selectedFile && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <File className="h-4 w-4" />
              <span>{selectedFile.name}</span>
              <Badge variant="secondary">{formatFileSize(selectedFile.size)}</Badge>
              <Badge variant="outline">{selectedFile.type}</Badge>
            </div>
          )}
        </div>

        {isUploading && (
          <div className="space-y-2">
            <Label>Upload Progress</Label>
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              Uploading to R2...
            </p>
          </div>
        )}

        <Button 
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Test Upload
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <Badge variant={result.success ? "default" : "destructive"}>
                {result.success ? "SUCCESS" : "FAILED"}
              </Badge>
              {result.duration && (
                <Badge variant="outline">
                  {formatDuration(result.duration)}
                </Badge>
              )}
              {result.fileSize && (
                <Badge variant="secondary">
                  {formatFileSize(result.fileSize)}
                </Badge>
              )}
            </div>
            
            <div className="space-y-2">
              {result.success ? (
                <div className="space-y-2">
                  <p className="font-medium text-green-600">Upload completed successfully!</p>
                  {result.url && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">File URL:</p>
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline break-all"
                      >
                        {result.url}
                      </a>
                    </div>
                  )}
                  {result.key && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">R2 Key:</p>
                      <code className="text-xs">{result.key}</code>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-medium text-red-600">Upload failed</p>
                  {result.error && (
                    <div className="p-3 bg-muted rounded-lg mt-2">
                      <p className="text-sm font-medium mb-1">Error:</p>
                      <p className="text-xs text-red-600">{result.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};