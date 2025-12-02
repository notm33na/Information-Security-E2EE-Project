import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { MessageSquare, Users, Shield, Key, Upload, AlertTriangle, ArrowUpRight, LogOut } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { StatCard } from '../components/shared/StatCard';
import { SecurityAlert } from '../components/shared/SecurityAlert';
import { ChatListItem } from '../components/chat/ChatListItem';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from '../hooks/use-toast';
import WebSocketTest from '../components/WebSocketTest';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useChatSessions } from '../hooks/useChatSessions';

export function Dashboard() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { stats, loading: statsLoading, alerts: recentAlerts } = useDashboardStats();
  const { sessions, loading: sessionsLoading } = useChatSessions();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      navigate('/login');
    } catch (err) {
      toast({
        title: "Logout error",
        description: err.message || "Failed to logout properly.",
        variant: "destructive",
      });
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  // Get recent chats (first 5)
  const recentChats = sessions.slice(0, 5);

  // Prepare stats array
  const statsArray = [
    { 
      icon: MessageSquare, 
      label: "Encrypted Messages", 
      value: stats.messages.toString(), 
      change: stats.messages > 0 ? "Active" : "None", 
      changeType: stats.messages > 0 ? "positive" : "neutral" 
    },
    { 
      icon: Users, 
      label: "Active Contacts", 
      value: stats.contacts.toString(), 
      change: stats.contacts > 0 ? "Active" : "None", 
      changeType: stats.contacts > 0 ? "positive" : "neutral" 
    },
    { 
      icon: Upload, 
      label: "Files Shared", 
      value: stats.filesShared.toString(), 
      change: stats.filesShared > 0 ? "Shared" : "None", 
      changeType: stats.filesShared > 0 ? "positive" : "neutral" 
    },
    { 
      icon: Key, 
      label: "Active Keys", 
      value: stats.activeKeys.toString(), 
      change: "Healthy", 
      changeType: "positive" 
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Dashboard" showMenu />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Welcome Section */}
        <div className="animate-fade-in">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Welcome back, {user?.email?.split('@')[0] || 'User'}!</h2>
          <p className="text-muted-foreground mt-1">Your communications are secure and encrypted</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-card border border-border">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          ) : (
            statsArray.map((stat, i) => (
              <StatCard
                key={i}
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                change={stat.change}
                changeType={stat.changeType}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Chats */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Recent Conversations</h3>
              <Link to="/chats">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2 bg-card rounded-xl p-3 border border-border">
              {sessionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))
              ) : recentChats.length > 0 ? (
                recentChats.map((chat) => (
                  <ChatListItem
                    key={chat.id}
                    {...chat}
                    onClick={() => navigate(`/chat/${chat.sessionId}`)}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent conversations</p>
              )}
            </div>

            {/* User Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <span className="text-sm text-foreground">{user?.email}</span>
                </div>
                {user?.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Account Created:</span>
                    <span className="text-sm text-foreground">{new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                )}
                {user?.lastLoginAt && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Last Login:</span>
                    <span className="text-sm text-foreground">{new Date(user.lastLoginAt).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <span className={`text-sm font-medium ${user?.isActive ? 'text-success' : 'text-destructive'}`}>
                    {user?.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="pt-4 border-t border-border">
                  <Button variant="outline" className="w-full" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* WebSocket Test */}
            <Card>
              <CardHeader>
                <CardTitle>WebSocket Connection</CardTitle>
              </CardHeader>
              <CardContent>
                <WebSocketTest />
              </CardContent>
            </Card>
          </div>

          {/* Security Status */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Security Alerts</h3>
              <Link to="/alerts">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {recentAlerts.length > 0 ? (
                recentAlerts.map((alert) => (
                  <SecurityAlert
                    key={alert.id}
                    severity={alert.severity}
                    title={alert.title}
                    description={alert.message}
                    timestamp={alert.timestamp}
                  />
                ))
              ) : (
                <SecurityAlert
                  severity="low"
                  title="System Operational"
                  description="All security systems are functioning normally."
                  timestamp="Just now"
                />
              )}
            </div>

            {/* Quick Actions */}
            <div className="p-4 rounded-xl bg-card border border-border">
              <h4 className="font-medium text-foreground mb-3">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/chats">
                  <Button variant="secondary" className="w-full justify-start">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    New Chat
                  </Button>
                </Link>
                <Link to="/files">
                  <Button variant="secondary" className="w-full justify-start">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload File
                  </Button>
                </Link>
                <Link to="/keys">
                  <Button variant="secondary" className="w-full justify-start">
                    <Key className="w-4 h-4 mr-2" />
                    Manage Keys
                  </Button>
                </Link>
                <Link to="/alerts">
                  <Button variant="secondary" className="w-full justify-start">
                    <Shield className="w-4 h-4 mr-2" />
                    Security
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
