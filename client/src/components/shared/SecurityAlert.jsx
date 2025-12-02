import { AlertTriangle, Shield, X, ChevronRight, AlertOctagon } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils.js";

const severityConfig = {
  low: {
    icon: Shield,
    bg: "bg-primary/5",
    border: "border-primary/30",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    badge: "bg-primary/20 text-primary",
  },
  medium: {
    icon: AlertTriangle,
    bg: "bg-warning/5",
    border: "border-warning/30",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    badge: "bg-warning/20 text-warning",
  },
  high: {
    icon: AlertTriangle,
    bg: "bg-destructive/5",
    border: "border-destructive/30",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    badge: "bg-destructive/20 text-destructive",
  },
  critical: {
    icon: AlertOctagon,
    bg: "bg-destructive/10",
    border: "border-destructive/50",
    iconBg: "bg-destructive/20",
    iconColor: "text-destructive",
    badge: "bg-destructive text-destructive-foreground",
  },
};

export function SecurityAlert({
  severity,
  title,
  description,
  timestamp,
  actionLabel,
  onAction,
  onDismiss,
  className,
  style,
}) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "relative p-4 rounded-xl border animate-fade-in",
        config.bg,
        config.border,
        severity === "critical" && "animate-pulse-glow",
        className
      )}
      style={style}
    >
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      )}

      <div className="flex items-start gap-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", config.iconBg)}>
          <Icon className={cn("w-6 h-6", config.iconColor)} />
        </div>

        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium uppercase", config.badge)}>
              {severity}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {description}
          </p>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-xs text-muted-foreground">{timestamp}</span>
            {onAction && (
              <Button variant="ghost" size="sm" onClick={onAction} className="h-7 text-xs">
                {actionLabel || "View Details"}
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

