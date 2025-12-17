import { File, Download, Lock, Trash2, Image, FileText, Archive, Film } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils.js";

const fileIcons = {
  image: Image,
  document: FileText,
  archive: Archive,
  video: Film,
  other: File,
};

const fileColors = {
  image: "bg-pink-500/20 text-pink-400",
  document: "bg-blue-500/20 text-blue-400",
  archive: "bg-amber-500/20 text-amber-400",
  video: "bg-purple-500/20 text-purple-400",
  other: "bg-muted text-muted-foreground",
};

/**
 * Maps MIME type to file category
 */
function getFileCategory(mimeType) {
  if (!mimeType) return 'other';
  
  const type = mimeType.toLowerCase();
  
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'other';
  if (type.includes('pdf') || type.includes('document') || type.includes('text') || 
      type.includes('word') || type.includes('excel') || type.includes('powerpoint') ||
      type.includes('spreadsheet') || type.includes('presentation')) {
    return 'document';
  }
  if (type.includes('zip') || type.includes('rar') || type.includes('tar') || 
      type.includes('gzip') || type.includes('7z') || type.includes('archive')) {
    return 'archive';
  }
  
  return 'other';
}

export function FileCard({
  name,
  size,
  type,
  uploadedAt,
  isEncrypted = true,
  onDownload,
  onDelete,
  className,
  style,
}) {
  const fileCategory = getFileCategory(type);
  const Icon = fileIcons[fileCategory] || File;

  return (
    <div
      className={cn(
        "group p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-200",
        className
      )}
      style={style}
    >
      <div className="flex items-start gap-4">
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", fileColors[fileCategory] || fileColors.other)}>
          <Icon className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground truncate">{name}</h3>
            {isEncrypted && <Lock className="w-3.5 h-3.5 text-success flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{size}</span>
            <span>•</span>
            <span>{uploadedAt}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onDownload && (
            <Button 
              variant="ghost" 
              size="icon-sm" 
              onClick={onDownload}
              title="Download file"
              className="opacity-70 hover:opacity-100"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
          {onDelete && (
            <Button 
              variant="ghost" 
              size="icon-sm" 
              onClick={onDelete}
              title="Delete file"
              className="opacity-70 hover:opacity-100 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

