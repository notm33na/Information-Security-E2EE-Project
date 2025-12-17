import { useState, useMemo, useEffect } from "react";
import { Header } from "../components/layout/Header";
import { SecurityAlert } from "../components/shared/SecurityAlert";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { useSecurityAlerts } from "../hooks/useSecurityAlerts";
import { useReadAlerts } from "../hooks/useReadAlerts";
import { formatChatTimestamp } from "../utils/formatTime";

export default function Alerts() {
  const [filter, setFilter] = useState("all");
  const { alerts, loading, error, refetch } = useSecurityAlerts();
  const { markAllAsRead } = useReadAlerts();

  // Mark all alerts as read when the page is opened
  useEffect(() => {
    if (!loading && alerts.length > 0) {
      const alertIds = alerts.map(a => a.id).filter(Boolean);
      if (alertIds.length > 0) {
        markAllAsRead(alertIds);
      }
    }
  }, [loading, alerts, markAllAsRead]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (filter === "all") return true;
      return alert.severity === filter;
    });
  }, [alerts, filter]);

  const alertCounts = useMemo(() => {
    return {
      all: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length,
    };
  }, [alerts]);

  return (
    <div className="min-h-screen">
      <Header title="Security Alerts" showMenu />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {["all", "low", "medium", "high", "critical"].map((severity) => (
            <Button
              key={severity}
              variant={filter === severity ? "default" : "secondary"}
              size="sm"
              onClick={() => setFilter(severity)}
              className="flex-shrink-0 capitalize"
            >
              {severity}
              {alertCounts[severity] > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1.5 text-xs">
                  {alertCounts[severity]}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Alerts List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-xl bg-card border border-border">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-2">Error loading alerts: {error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredAlerts.map((alert, i) => (
                <SecurityAlert
                  key={alert.id || i}
                  title={alert.title}
                  description={alert.message || alert.description}
                  severity={alert.severity}
                  timestamp={formatChatTimestamp(alert.timestamp)}
                  className="animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                />
              ))}
            </div>

            {filteredAlerts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg font-medium">No security alerts</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {filter === "all" 
                    ? "All systems are operating normally." 
                    : `No ${filter} severity alerts found.`}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

