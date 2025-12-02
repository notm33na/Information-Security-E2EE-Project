import { Check, CheckCheck, Lock, File } from "lucide-react";
import { cn } from "../../lib/utils.js";

export function ChatBubble({
  message,
  timestamp,
  isSender,
  isRead = false,
  isEncrypted = true,
  hasFile = false,
  fileName,
  fileSize,
}) {
  return (
    <div
      className={cn(
        "flex w-full mb-3 animate-fade-in",
        isSender ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] sm:max-w-[70%] lg:max-w-[60%] rounded-2xl px-4 py-3 relative",
          isSender
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-secondary text-secondary-foreground rounded-bl-md"
        )}
      >
        {hasFile && (
          <div
            className={cn(
              "flex items-center gap-3 p-2.5 rounded-lg mb-2",
              isSender ? "bg-primary-foreground/10" : "bg-background/50"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                isSender ? "bg-primary-foreground/20" : "bg-primary/20"
              )}
            >
              <File className={cn("w-5 h-5", isSender ? "text-primary-foreground" : "text-primary")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <p className={cn("text-xs", isSender ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {fileSize}
              </p>
            </div>
          </div>
        )}

        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message}
        </p>

        <div
          className={cn(
            "flex items-center gap-1.5 mt-1.5",
            isSender ? "justify-end" : "justify-start"
          )}
        >
          {isEncrypted && (
            <Lock
              className={cn(
                "w-3 h-3",
                isSender ? "text-primary-foreground/50" : "text-muted-foreground"
              )}
            />
          )}
          <span
            className={cn(
              "text-[10px]",
              isSender ? "text-primary-foreground/60" : "text-muted-foreground"
            )}
          >
            {timestamp}
          </span>
          {isSender && (
            isRead ? (
              <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/60" />
            ) : (
              <Check className="w-3.5 h-3.5 text-primary-foreground/60" />
            )
          )}
        </div>
      </div>
    </div>
  );
}

