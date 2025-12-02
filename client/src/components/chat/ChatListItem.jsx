import { Lock, CheckCheck } from "lucide-react";
import { cn } from "../../lib/utils.js";

export function ChatListItem({
  name,
  avatar,
  lastMessage,
  timestamp,
  unreadCount = 0,
  isOnline = false,
  isEncrypted = true,
  isActive = false,
  onClick,
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left",
        isActive
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-secondary border border-transparent"
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-accent flex items-center justify-center">
            <span className="text-sm font-semibold text-primary-foreground">
              {initials}
            </span>
          </div>
        )}
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success rounded-full border-2 border-background" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground truncate">{name}</span>
            {isEncrypted && <Lock className="w-3 h-3 text-success flex-shrink-0" />}
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {timestamp}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5 flex-shrink-0" />
            {lastMessage}
          </p>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full flex-shrink-0">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

