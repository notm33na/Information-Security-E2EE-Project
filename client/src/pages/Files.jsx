import { useState, useRef } from "react";
import { Upload, Search, Filter, Grid, List, Plus, HardDrive, X, CheckCircle2, AlertCircle, Database } from "lucide-react";
import { Header } from "../components/layout/Header";
import { FileCard } from "../components/shared/FileCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils.js";
import { useFiles } from "../hooks/useFiles";
import { useFileUpload } from "../hooks/useFileUpload";

export default function Files() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const fileInputRef = useRef(null);
  const { files, loading, error, totalSizeGB, maxStorageGB, storageUsed, refetch } = useFiles();
  const { uploadFile, downloadFile, deleteFile, uploading, progress } = useFileUpload();

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileSelect = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploadError(null);
    setUploadSuccess(null);

    for (const file of Array.from(selectedFiles)) {
      try {
        await uploadFile(file);
        setUploadSuccess(`File "${file.name}" uploaded successfully!`);
        // Refresh file list
        await refetch();
        // Clear success message after 3 seconds
        setTimeout(() => setUploadSuccess(null), 3000);
      } catch (err) {
        setUploadError(err.message || 'Failed to upload file');
        setTimeout(() => setUploadError(null), 5000);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFileSelect(selectedFiles);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadFile = async (file) => {
    try {
      // Only use fileId, not id (id is messageId, not the actual fileId)
      if (!file.fileId) {
        console.error('File ID not found - this file may not be available for download');
        setUploadError('This file cannot be downloaded. Only files uploaded to storage can be downloaded.');
        setTimeout(() => setUploadError(null), 5000);
        return;
      }
      
      const result = await downloadFile(file.fileId);
      
      // Create download link
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setUploadSuccess(`File "${result.filename}" downloaded successfully!`);
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to download file:', err);
      setUploadError(err.message || 'Failed to download file');
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Are you sure you want to delete "${file.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Only use fileId, not id (id is messageId, not the actual fileId)
      if (!file.fileId) {
        console.error('File ID not found - this file may not be available for deletion');
        setUploadError('This file cannot be deleted. Only files uploaded to storage can be deleted.');
        setTimeout(() => setUploadError(null), 5000);
        return;
      }
      
      await deleteFile(file.fileId);
      
      setUploadSuccess(`File "${file.name}" deleted successfully!`);
      setTimeout(() => setUploadSuccess(null), 3000);
      
      // Refresh file list
      await refetch();
    } catch (err) {
      console.error('Failed to delete file:', err);
      setUploadError(err.message || 'Failed to delete file');
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen">
      <Header title="Encrypted Files" showMenu />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative p-8 rounded-xl border-2 border-dashed transition-all duration-300 text-center",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-card",
            uploading && "opacity-75 pointer-events-none"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className={cn("w-8 h-8 text-primary transition-transform", isDragging && "scale-110")} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {uploading ? `Uploading... ${Math.round(progress)}%` : "Drop files here to encrypt & upload"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {uploading ? "Files are encrypted locally before upload" : "Files are encrypted locally before upload"}
              </p>
            </div>
            {uploading ? (
              <div className="w-full max-w-md">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <Button onClick={handleBrowseClick} disabled={uploading}>
                <Plus className="w-4 h-4 mr-2" />
                Browse Files
              </Button>
            )}
          </div>
        </div>

        {/* Upload Status Messages */}
        {uploadError && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive flex-1">{uploadError}</p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setUploadError(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {uploadSuccess && (
          <div className="p-4 rounded-xl bg-success/10 border border-success/20 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
            <p className="text-sm text-success flex-1">{uploadSuccess}</p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setUploadSuccess(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Storage Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Storage Used</p>
                <p className="text-lg font-semibold text-foreground">
                  {totalSizeGB.toFixed(2)} GB / {maxStorageGB} GB
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(storageUsed, 100)}%` }}
              />
            </div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Encrypted Files</p>
                <p className="text-lg font-semibold text-foreground">{files.length} files</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">All files use AES-256 encryption</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
              className="pl-10"
            />
          </div>
          <Button variant="secondary" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
          <div className="flex items-center border border-border rounded-lg p-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* File List */}
        {loading ? (
          <div className={cn(
            viewMode === "grid" 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-3"
          )}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-card border border-border">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive">Error loading files: {error}</p>
          </div>
        ) : (
          <>
            <div className={cn(
              viewMode === "grid" 
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-3"
            )}>
              {filteredFiles.map((file, i) => (
                <FileCard
                  key={file.id || i}
                  name={file.name}
                  size={formatFileSize(file.size)}
                  type={file.type}
                  encrypted={file.encrypted}
                  uploadedAt={file.uploadedAt}
                  onDownload={() => handleDownloadFile(file)}
                  onDelete={() => handleDeleteFile(file)}
                  className="animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                />
              ))}
            </div>

            {filteredFiles.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No files found</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

