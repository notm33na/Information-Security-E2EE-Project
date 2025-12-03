import { Progress } from "../ui/progress";
import { Download, Upload, X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils.js";

/**
 * File Progress Component
 * Shows progress for file upload/download/reassembly
 */
export function FileProgress({ 
  filename, 
  progress, 
  speed, 
  timeRemaining, 
  type = 'upload', // 'upload' | 'download' | 'reassemble'
  onCancel,
  className 
}) {
  const isUpload = type === 'upload';
  const isDownload = type === 'download';
  const isReassemble = type === 'reassemble';

  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond) return '';
    if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds === Infinity) return '';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className={cn(
      "p-4 rounded-xl bg-card border border-border",
      className
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          isUpload && "bg-primary/10",
          isDownload && "bg-success/10",
          isReassemble && "bg-warning/10"
        )}>
          {isUpload && <Upload className={cn("w-5 h-5", "text-primary")} />}
          {isDownload && <Download className={cn("w-5 h-5", "text-success")} />}
          {isReassemble && <Download className={cn("w-5 h-5", "text-warning")} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-foreground">{filename}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {isUpload && 'Uploading...'}
              {isDownload && 'Downloading...'}
              {isReassemble && 'Reassembling...'}
            </span>
            {speed && (
              <span className="text-xs text-muted-foreground">
                • {formatSpeed(speed)}
              </span>
            )}
            {timeRemaining && (
              <span className="text-xs text-muted-foreground">
                • {formatTime(timeRemaining)} remaining
              </span>
            )}
          </div>
        </div>
        {onCancel && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCancel}
            className="flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      <Progress value={progress} className="h-2" />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}

