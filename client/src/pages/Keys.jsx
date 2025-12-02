import { useState } from "react";
import { Key, Plus, RefreshCw, Shield, Copy, Eye, EyeOff, Download, Trash2, Clock } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import { KeyStatusBadge } from "../components/shared/KeyStatusBadge";
import { cn } from "../lib/utils.js";
import { useKeys } from "../hooks/useKeys";

export default function Keys() {
  const [showFingerprint, setShowFingerprint] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const { keys, loading, error } = useKeys();

  const toggleFingerprint = (id) => {
    setShowFingerprint((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGenerateKey = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 2000);
  };

  return (
    <div className="min-h-screen">
      <Header title="Key Management" showMenu />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Key Generation */}
        <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center glow-primary">
                <Key className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Generate New Key Pair</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Create a new RSA-4096 or AES-256 encryption key
                </p>
              </div>
            </div>
            <Button onClick={handleGenerateKey} disabled={isGenerating} className="w-full sm:w-auto">
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Key
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-4 rounded-xl bg-success/5 border border-success/20">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Keys are stored securely</p>
              <p className="text-xs text-muted-foreground mt-1">
                All private keys are encrypted with your master password and never leave your device.
              </p>
            </div>
          </div>
        </div>

        {/* Keys List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Your Keys</h3>
          
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading keys...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-destructive">Error loading keys: {error}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key, i) => (
              <div
                key={key.id}
                className={cn(
                  "p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-200 animate-fade-in",
                  key.status === "expired" && "opacity-60"
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      key.status === "active" && "bg-success/10",
                      key.status === "expiring" && "bg-warning/10",
                      key.status === "expired" && "bg-destructive/10"
                    )}>
                      <Key className={cn(
                        "w-6 h-6",
                        key.status === "active" && "text-success",
                        key.status === "expiring" && "text-warning",
                        key.status === "expired" && "text-destructive"
                      )} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-foreground">{key.name}</h4>
                        <KeyStatusBadge status={key.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {key.type} • {key.expiresAt}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                          {showFingerprint[key.id] ? key.fingerprint : "•••• •••• •••• •••• ••••"}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => toggleFingerprint(key.id)}
                        >
                          {showFingerprint[key.id] ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon-sm">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:flex-shrink-0">
                    {key.status !== "expired" && (
                      <>
                        <Button variant="secondary" size="sm">
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          Rotate
                        </Button>
                        <Button variant="secondary" size="sm">
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          Export
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Created {key.createdAt}
                  </span>
                </div>
              </div>
              ))}
            </div>
          )}

          {!loading && !error && keys.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No keys found</p>
              <p className="text-sm text-muted-foreground mt-2">
                Generate a key pair during registration or create one manually.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

