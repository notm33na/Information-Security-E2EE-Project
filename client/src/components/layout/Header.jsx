import { Bell, Search, Menu, Lock, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils.js";
import { useTheme } from "../../context/ThemeContext";
import { useSecurityAlerts } from "../../hooks/useSecurityAlerts";
import { useReadAlerts } from "../../hooks/useReadAlerts";

export function Header({
  title,
  showSearch = true,
  showMenu = false,
  onMenuClick,
  className,
}) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { alerts = [] } = useSecurityAlerts();
  const { isRead } = useReadAlerts();
  
  // Count unread/critical alerts
  const unreadAlertCount = alerts.filter(a => 
    (a.severity === 'critical' || a.severity === 'high') && !isRead(a.id)
  ).length;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-background/80 backdrop-blur-xl border-b border-border",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {showMenu && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden">
            <Menu className="w-5 h-5" />
          </Button>
        )}
        {title && (
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {showSearch && (
          <div className="hidden sm:flex items-center relative max-w-xs">
            <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9 w-48 lg:w-64 bg-secondary/50"
            />
          </div>
        )}

        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          onClick={() => navigate('/alerts')}
          title="Security Alerts"
        >
          <Bell className="w-5 h-5" />
          {unreadAlertCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
              {unreadAlertCount > 9 ? '9+' : unreadAlertCount}
            </span>
          )}
        </Button>

        <Button variant="ghost" size="icon" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </Button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
          <Lock className="w-3.5 h-3.5 text-success" />
          <span className="text-xs font-medium text-success hidden sm:inline">Encrypted</span>
        </div>
      </div>
    </header>
  );
}

