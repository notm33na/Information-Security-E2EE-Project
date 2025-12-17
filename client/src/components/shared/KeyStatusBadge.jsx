import { Key, CheckCircle, AlertCircle, XCircle, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils.js";

const statusConfig = {
  active: {
    icon: CheckCircle,
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/20",
    label: "Active",
  },
  inactive: {
    icon: XCircle,
    bg: "bg-muted/10",
    text: "text-muted-foreground",
    border: "border-muted/20",
    label: "Inactive",
  },
  expiring: {
    icon: AlertCircle,
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/20",
    label: "Expiring Soon",
  },
  expired: {
    icon: XCircle,
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/20",
    label: "Expired",
  },
  rotating: {
    icon: RefreshCw,
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
    label: "Rotating",
  },
};

export function KeyStatusBadge({
  status,
  label,
  showIcon = true,
  className,
}) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
        config.bg,
        config.text,
        config.border,
        status === "rotating" && "animate-pulse",
        className
      )}
    >
      {showIcon && (
        <Icon className={cn("w-3.5 h-3.5", status === "rotating" && "animate-spin")} />
      )}
      <span>{label || config.label}</span>
    </div>
  );
}

