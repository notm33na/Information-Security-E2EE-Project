import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils.js";

/**
 * Error Message Component
 * Displays user-friendly error messages with optional retry
 */
export function ErrorMessage({ 
  title, 
  message, 
  onRetry, 
  onDismiss,
  variant = "default", // "default" | "destructive" | "warning"
  className 
}) {
  return (
    <div className={cn(
      "p-4 rounded-xl border",
      variant === "destructive" && "bg-destructive/5 border-destructive/20",
      variant === "warning" && "bg-warning/5 border-warning/20",
      variant === "default" && "bg-card border-border",
      className
    )}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn(
          "w-5 h-5 flex-shrink-0 mt-0.5",
          variant === "destructive" && "text-destructive",
          variant === "warning" && "text-warning",
          variant === "default" && "text-muted-foreground"
        )} />
        <div className="flex-1 min-w-0">
          {title && (
            <p className={cn(
              "text-sm font-medium mb-1",
              variant === "destructive" && "text-destructive",
              variant === "warning" && "text-warning",
              variant === "default" && "text-foreground"
            )}>
              {title}
            </p>
          )}
          <p className={cn(
            "text-sm",
            variant === "destructive" && "text-destructive/80",
            variant === "warning" && "text-warning/80",
            variant === "default" && "text-muted-foreground"
          )}>
            {message}
          </p>
          {(onRetry || onDismiss) && (
            <div className="flex items-center gap-2 mt-3">
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="h-7"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Retry
                </Button>
              )}
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="h-7"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

