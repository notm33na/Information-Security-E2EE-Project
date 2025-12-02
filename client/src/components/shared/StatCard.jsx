import { cn } from "../../lib/utils.js";

export function StatCard({
  icon: Icon,
  label,
  value,
  change,
  changeType = "neutral",
  className,
  style,
}) {
  return (
    <div
      className={cn(
        "p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-200",
        className
      )}
      style={style}
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {change && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              changeType === "positive" && "bg-success/10 text-success",
              changeType === "negative" && "bg-destructive/10 text-destructive",
              changeType === "neutral" && "bg-muted text-muted-foreground"
            )}
          >
            {change}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

