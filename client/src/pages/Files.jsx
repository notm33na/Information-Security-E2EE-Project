import { useState } from "react";
import { Upload, Search, Filter, Grid, List, Plus, Cloud, HardDrive } from "lucide-react";
import { Header } from "../components/layout/Header";
import { FileCard } from "../components/shared/FileCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib/utils.js";
import { useFiles } from "../hooks/useFiles";

export default function Files() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [isDragging, setIsDragging] = useState(false);
  const { files, loading, error, totalSizeGB, maxStorageGB, storageUsed } = useFiles();

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <Header title="Encrypted Files" showMenu />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Upload Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={() => setIsDragging(false)}
          className={cn(
            "relative p-8 rounded-xl border-2 border-dashed transition-all duration-300 text-center",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-card"
          )}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className={cn("w-8 h-8 text-primary transition-transform", isDragging && "scale-110")} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Drop files here to encrypt & upload
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Files are encrypted locally before upload
              </p>
            </div>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Browse Files
            </Button>
          </div>
        </div>

        {/* Storage Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Cloud className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cloud Storage</p>
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
                  size={file.size}
                  type={file.type}
                  encrypted={file.encrypted}
                  uploadedAt={file.uploadedAt}
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

