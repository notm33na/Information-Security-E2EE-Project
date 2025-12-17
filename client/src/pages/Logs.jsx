import { useState } from "react";
import { Search, Filter, Shield, AlertTriangle } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useLogs } from "../hooks/useLogs";

const logLevels = {
  info: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  error: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
};

export default function Logs() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const { logs, loading, error, refetch } = useLogs();

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = (log.message || log.title || '').toLowerCase().includes(search.toLowerCase());
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    
    // Special handling for MITM attack filter
    let matchesEventType = true;
    if (eventTypeFilter === "mitm_attack") {
      matchesEventType = log.eventType === 'invalid_signature' && 
                        log.metadata?.isSimulation && 
                        log.metadata?.attackType;
    } else if (eventTypeFilter === "invalid_signature") {
      // Exclude MITM simulations from regular invalid signature filter
      matchesEventType = log.eventType === eventTypeFilter && 
                       !(log.metadata?.isSimulation && log.metadata?.attackType);
    } else {
      matchesEventType = eventTypeFilter === "all" || log.eventType === eventTypeFilter;
    }
    
    return matchesSearch && matchesLevel && matchesEventType;
  });

  // Count replay attacks and MITM attacks
  const replayAttackCount = logs.filter(log => log.eventType === 'replay_attempt').length;
  const mitmAttackCount = logs.filter(log => 
    log.eventType === 'invalid_signature' && 
    log.metadata?.isSimulation && 
    log.metadata?.attackType
  ).length;

  return (
    <div className="min-h-screen">
      <Header title="System Logs" showMenu />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="pl-10"
            />
          </div>
          <Button variant="secondary" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {["all", "info", "warning", "error", "success"].map((level) => (
            <Button
              key={level}
              variant={levelFilter === level ? "default" : "secondary"}
              size="sm"
              onClick={() => setLevelFilter(level)}
              className="flex-shrink-0 capitalize"
            >
              {level}
            </Button>
          ))}
        </div>

        {/* Event Type Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <span className="text-sm text-muted-foreground mr-2">Event Type:</span>
          {[
            { value: "all", label: "All Events" },
            { value: "replay_attempt", label: `Replay Attacks (${replayAttackCount})`, icon: Shield },
            { value: "mitm_attack", label: `MITM Attacks (${mitmAttackCount})`, icon: AlertTriangle },
            { value: "invalid_signature", label: "Invalid Signatures" },
            { value: "decryption_error", label: "Decryption Errors" },
            { value: "timestamp_failure", label: "Timestamp Failures" },
            { value: "seq_mismatch", label: "Sequence Mismatches" }
          ].map((eventType) => (
            <Button
              key={eventType.value}
              variant={eventTypeFilter === eventType.value ? "default" : "secondary"}
              size="sm"
              onClick={() => setEventTypeFilter(eventType.value)}
              className="flex-shrink-0 flex items-center gap-1"
            >
              {eventType.icon && <eventType.icon className="w-3.5 h-3.5" />}
              {eventType.label}
            </Button>
          ))}
        </div>
        
        {/* Debug Info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Total logs: {logs.length} | Filtered: {filteredLogs.length} | Loading: {loading ? 'Yes' : 'No'} | Error: {error || 'None'}</div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refetch}
              className="mt-2"
            >
              Refresh Logs
            </Button>
          </div>
        )}

        {/* Logs List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading logs...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive">Error loading logs: {error}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredLogs.map((log, i) => (
                <Card key={log.id} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{log.title || log.message}</CardTitle>
                      <Badge className={logLevels[log.level] || logLevels.info}>
                        {log.level}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{log.message}</p>
                    {log.eventType === 'replay_attempt' && log.metadata && (
                      <div className="mt-3 p-2 bg-warning/5 border border-warning/20 rounded text-xs">
                        <div className="font-semibold text-warning mb-1">Replay Attack Details:</div>
                        <div className="space-y-1 text-muted-foreground">
                          {log.metadata.sessionId && (
                            <div>Session: <code className="bg-muted px-1 rounded">{log.metadata.sessionId.substring(0, 16)}...</code></div>
                          )}
                          {log.metadata.seq !== undefined && (
                            <div>Sequence Number: <code className="bg-muted px-1 rounded">{log.metadata.seq}</code></div>
                          )}
                          {log.metadata.timestamp && (
                            <div>Message Timestamp: {new Date(log.metadata.timestamp).toLocaleString()}</div>
                          )}
                          {log.metadata.reason && (
                            <div>Reason: <span className="font-medium">{log.metadata.reason}</span></div>
                          )}
                        </div>
                      </div>
                    )}
                    {log.eventType === 'invalid_signature' && log.metadata?.isSimulation && log.metadata?.attackType && (
                      <div className="mt-3 p-2 bg-destructive/5 border border-destructive/20 rounded text-xs">
                        <div className="font-semibold text-destructive mb-1">MITM Attack Simulation Details:</div>
                        <div className="space-y-1 text-muted-foreground">
                          {log.metadata.attackId && (
                            <div>Attack ID: <code className="bg-muted px-1 rounded">{log.metadata.attackId}</code></div>
                          )}
                          {log.metadata.attackType && (
                            <div>Attack Type: <span className="font-medium">{log.metadata.attackType}</span></div>
                          )}
                          {log.metadata.flow?.result && (
                            <>
                              <div>Result: <span className={`font-medium ${log.metadata.flow.result.success ? 'text-destructive' : 'text-warning'}`}>
                                {log.metadata.flow.result.success ? 'SUCCESS' : 'BLOCKED'}
                              </span></div>
                              {log.metadata.flow.result.reason && (
                                <div>Reason: <span className="font-medium">{log.metadata.flow.result.reason}</span></div>
                              )}
                              {log.metadata.flow.result.protection && (
                                <div>Protection: <span className="font-medium text-success">{log.metadata.flow.result.protection}</span></div>
                              )}
                              {log.metadata.flow.duration && (
                                <div>Duration: {log.metadata.flow.duration}ms</div>
                              )}
                              {log.metadata.flow.steps && log.metadata.flow.steps.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-destructive/10">
                                  <div className="font-semibold mb-1">Attack Flow ({log.metadata.flow.steps.length} steps):</div>
                                  <div className="space-y-0.5 max-h-32 overflow-y-auto">
                                    {log.metadata.flow.steps.slice(0, 5).map((step, idx) => (
                                      <div key={idx} className="text-xs">
                                        {idx + 1}. {step.description} ({step.elapsed}ms)
                                      </div>
                                    ))}
                                    {log.metadata.flow.steps.length > 5 && (
                                      <div className="text-xs italic">... and {log.metadata.flow.steps.length - 5} more steps</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                      {log.source && <span>• {log.source}</span>}
                      {log.sessionId && (
                        <span>• Session: <code className="bg-muted px-1 rounded">{log.sessionId.substring(0, 8)}...</code></span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredLogs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {eventTypeFilter === 'replay_attempt' 
                    ? 'No replay attack logs found. Replay attacks will appear here when detected.'
                    : eventTypeFilter === 'mitm_attack'
                    ? 'No MITM attack logs found. MITM attack simulations will appear here when run.'
                    : 'No logs found'}
                </p>
                {eventTypeFilter === 'replay_attempt' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Tip: Run the Replay Attack Demo at <code>/replay-demo</code> to generate test logs
                  </p>
                )}
                {eventTypeFilter === 'mitm_attack' && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Tip: Run the MITM attack simulation script to generate test logs
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

