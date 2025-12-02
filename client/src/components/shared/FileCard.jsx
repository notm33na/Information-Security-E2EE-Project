import { File, Download, Lock, MoreVertical, Image, FileText, Archive, Film } from "lucide-react";
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

export function FileCard({
  name,
  size,
  type,
  uploadedAt,
  isEncrypted = true,
  onDownload,
  className,
  style,
}) {
  const Icon = fileIcons[type];

  return (
    <div
      className={cn(
        "group p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-200",
        className
      )}
      style={style}
    >
      <div className="flex items-start gap-4">
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", fileColors[type])}>
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

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon-sm" onClick={onDownload}>
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon-sm">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

