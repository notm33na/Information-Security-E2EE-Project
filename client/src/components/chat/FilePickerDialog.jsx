import { useState, useEffect, useRef } from 'react';
import { X, File, Loader2, Search, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useFiles } from '../../hooks/useFiles';
import { formatFileSize } from '../../lib/utils';

export function FilePickerDialog({ open, onOpenChange, onSelectFile, onSelectNewFile }) {
  const fileInputRef = useRef(null);
  const { files, loading } = useFiles();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [preparing, setPreparing] = useState(false);

  // Only show files that have a fileId (uploaded to storage, not just message files)
  const availableFiles = files.filter((file) => file.fileId);
  
  const filteredFiles = availableFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = async (file) => {
    if (!file || preparing) return;
    
    setSelectedFileId(file.id);
    setPreparing(true);
    
    try {
      // Call the onSelectFile callback with the file
      await onSelectFile(file);
      onOpenChange(false);
      setSearchQuery('');
      setSelectedFileId(null);
    } catch (error) {
      console.error('Failed to prepare file:', error);
      alert(error.message || 'Failed to prepare file. Please try again.');
    } finally {
      setPreparing(false);
      setSelectedFileId(null);
    }
  };

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedFileId(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select File to Send</DialogTitle>
          <DialogDescription>
            Choose a file from your encrypted files or upload a new one
          </DialogDescription>
        </DialogHeader>

        {/* Upload New File Button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              if (onSelectNewFile) {
                onSelectNewFile();
              } else if (fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload New File
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onSelectNewFile) {
                onSelectNewFile(file);
                onOpenChange(false);
              }
            }}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="pl-10"
          />
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-2 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery 
                ? 'No files found matching your search' 
                : availableFiles.length === 0
                  ? 'No files uploaded to storage. Upload files in the Files section to share them in chats.'
                  : 'No files match your search'}
            </div>
          ) : (
            filteredFiles.map((file) => (
              <button
                key={file.id}
                onClick={() => handleSelect(file)}
                disabled={preparing}
                className="w-full p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <File className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(file.size || 0)}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {file.uploadedAt}
                      </span>
                    </div>
                  </div>
                  {selectedFileId === file.id && preparing && (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

