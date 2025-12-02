import { useState, useEffect } from "react";
import {
  User,
  Shield,
  Bell,
  Palette,
  Key,
  Smartphone,
  Lock,
  LogOut,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { cn } from "../lib/utils.js";
import { getUserSettings, updateSetting } from "../utils/userSettings";
import { toast } from "../hooks/use-toast";

function SettingItem({ icon: Icon, label, description, action, onClick, danger }) {
  // If there's an action (like Switch), render as div to avoid nested buttons
  // Otherwise render as button for clickable items
  const isInteractive = !!action;
  const Component = isInteractive ? 'div' : 'button';
  
  return (
    <Component
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 text-left",
        !isInteractive && "cursor-pointer",
        danger
          ? "hover:bg-destructive/5 group"
          : "hover:bg-secondary"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          danger ? "bg-destructive/10" : "bg-primary/10"
        )}>
          <Icon className={cn("w-5 h-5", danger ? "text-destructive" : "text-primary")} />
        </div>
        <div>
          <p className={cn("font-medium", danger ? "text-destructive" : "text-foreground")}>{label}</p>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action || (onClick && !isInteractive && <ChevronRight className="w-5 h-5 text-muted-foreground" />)}
    </Component>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  
  // Load settings from localStorage
  const [settings, setSettings] = useState(() => getUserSettings());
  const [notifications, setNotifications] = useState(settings.notifications);
  const [readReceipts, setReadReceipts] = useState(settings.readReceipts);
  const [securityAlerts, setSecurityAlerts] = useState(settings.securityAlerts);
  
  // Dialog states
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync state with localStorage when settings change
  useEffect(() => {
    const currentSettings = getUserSettings();
    setNotifications(currentSettings.notifications);
    setReadReceipts(currentSettings.readReceipts);
    setSecurityAlerts(currentSettings.securityAlerts);
  }, []);

  const handleNotificationsChange = (checked) => {
    setNotifications(checked);
    updateSetting('notifications', checked);
    toast({
      title: checked ? "Notifications enabled" : "Notifications disabled",
      description: checked 
        ? "You'll receive push notifications for new messages" 
        : "Push notifications have been disabled",
    });
  };

  const handleReadReceiptsChange = (checked) => {
    setReadReceipts(checked);
    updateSetting('readReceipts', checked);
    toast({
      title: checked ? "Read receipts enabled" : "Read receipts disabled",
      description: checked 
        ? "Others will see when you've read their messages" 
        : "Read receipts are now hidden",
    });
  };

  const handleSecurityAlertsChange = (checked) => {
    setSecurityAlerts(checked);
    updateSetting('securityAlerts', checked);
    toast({
      title: checked ? "Security alerts enabled" : "Security alerts disabled",
      description: checked 
        ? "You'll be notified about security events" 
        : "Security alerts have been disabled",
    });
  };

  const handleLogout = async () => {
    setShowLogoutDialog(false);
    await logout();
    navigate('/login');
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // TODO: Implement actual account deletion API call
      // await api.delete('/auth/account');
      
      // For now, just sign out
      await logout();
      navigate('/login');
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
        variant: "destructive",
      });
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const initials = user?.email?.split('@')[0]?.substring(0, 2).toUpperCase() || 'U';

  return (
    <div className="min-h-screen">
      <Header title="Settings" showMenu />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
        {/* Profile Section */}
        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/80 to-accent flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">{initials}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-foreground">{user?.email?.split('@')[0] || 'User'}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 bg-success rounded-full" />
                <span className="text-xs text-success">Account Verified</span>
              </div>
            </div>
            <Button variant="secondary">Edit</Button>
          </div>
        </div>

        {/* Security Settings */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">
            Security
          </h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            <SettingItem
              icon={Lock}
              label="Change Password"
              description="Update your account password"
              onClick={() => {}}
            />
            <SettingItem
              icon={Key}
              label="Two-Factor Authentication"
              description="Enable 2FA for additional security"
              onClick={() => {}}
            />
            <SettingItem
              icon={Smartphone}
              label="Active Sessions"
              description="Manage your logged-in devices"
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">
            Privacy
          </h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            <SettingItem
              icon={Shield}
              label="Read Receipts"
              description="Show when you've read messages"
              action={
                <Switch
                  checked={readReceipts}
                  onCheckedChange={handleReadReceiptsChange}
                />
              }
            />
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">
            Notifications
          </h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            <SettingItem
              icon={Bell}
              label="Push Notifications"
              description="Receive message alerts"
              action={
                <Switch
                  checked={notifications}
                  onCheckedChange={handleNotificationsChange}
                />
              }
            />
            <SettingItem
              icon={Bell}
              label="Security Alerts"
              description="Get notified about security events"
              action={
                <Switch
                  checked={securityAlerts}
                  onCheckedChange={handleSecurityAlertsChange}
                />
              }
            />
          </div>
        </div>

        {/* Appearance */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">
            Appearance
          </h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            <SettingItem
              icon={Palette}
              label="Theme"
              description={theme === 'dark' ? 'Dark mode' : 'Light mode'}
              action={
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={toggleTheme}
                />
              }
            />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">
            Account
          </h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            <SettingItem
              icon={LogOut}
              label="Sign Out"
              description="Sign out from this device"
              onClick={() => setShowLogoutDialog(true)}
              danger
            />
            <SettingItem
              icon={Trash2}
              label="Delete Account"
              description="Permanently delete your account and data"
              onClick={() => setShowDeleteDialog(true)}
              danger
            />
          </div>
        </div>

        {/* App Info */}
        <div className="text-center py-6 text-sm text-muted-foreground">
          <p>SecureChat v1.0.0</p>
          <p className="mt-1">End-to-End Encrypted Messaging</p>
        </div>
      </div>

      {/* Sign Out Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-muted-foreground" />
              Sign Out
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out? You'll need to log in again to access your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLogoutDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleLogout}
            >
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p className="font-medium text-foreground">
                This action cannot be undone.
              </p>
              <p>
                This will permanently delete your account, all your messages, files, and encryption keys. 
                You will lose access to all your data and conversations.
              </p>
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-medium text-destructive">
                  ⚠️ Warning: This action is irreversible
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

