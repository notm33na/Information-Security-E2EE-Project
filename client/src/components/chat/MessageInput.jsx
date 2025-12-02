import { useState } from "react";
import { Send, Paperclip, Smile, Lock } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils.js";

export function MessageInput({ onSend, onAttach, className }) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      onSend?.(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("p-3 bg-card/80 backdrop-blur-xl border-t border-border", className)}>
      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onAttach}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="w-5 h-5" />
        </Button>

        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a secure message..."
            rows={1}
            className="w-full min-h-[44px] max-h-32 px-4 py-3 pr-12 bg-secondary rounded-xl text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 scrollbar-thin"
            style={{ height: "44px" }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-2 bottom-1.5 text-muted-foreground hover:text-foreground"
          >
            <Smile className="w-5 h-5" />
          </Button>
        </div>

        <Button
          onClick={handleSend}
          disabled={!message.trim()}
          size="icon"
          className="flex-shrink-0"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-2">
        <Lock className="w-3 h-3 text-success" />
        <span className="text-[10px] text-muted-foreground">
          End-to-end encrypted
        </span>
      </div>
    </div>
  );
}

