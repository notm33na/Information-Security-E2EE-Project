import { Link, useLocation } from "react-router-dom";
import {
  MessageSquare,
  Shield,
  Key,
  Upload,
  AlertTriangle,
  FileText,
  Settings,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react";
import { cn } from "../../lib/utils.js";
import { Button } from "../ui/button";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: MessageSquare, label: "Chats", href: "/chats" },
  { icon: Upload, label: "Files", href: "/files" },
  { icon: Key, label: "Keys", href: "/keys" },
  { icon: AlertTriangle, label: "Alerts", href: "/alerts", badge: "3" },
  { icon: FileText, label: "Logs", href: "/logs" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar({ collapsed = false, onToggle, className }) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center glow-primary">
            <Lock className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-lg font-semibold text-foreground">SecureChat</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                E2E Encrypted
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href === "/chats" && location.pathname.startsWith("/chat"));
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 transition-all duration-200",
                  isActive && "text-primary"
                )}
              />
              {!collapsed && (
                <span className="font-medium animate-fade-in">{item.label}</span>
              )}
              {item.badge && !collapsed && (
                <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-destructive/20 text-destructive rounded-full animate-fade-in">
                  {item.badge}
                </span>
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full justify-center"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>

      {/* Security Status */}
      {!collapsed && (
        <div className="p-3 mx-3 mb-3 rounded-lg bg-success/5 border border-success/20 animate-fade-in">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-success" />
            <span className="text-xs font-medium text-success">Connection Secure</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            256-bit AES encryption active
          </p>
        </div>
      )}
    </aside>
  );
}

