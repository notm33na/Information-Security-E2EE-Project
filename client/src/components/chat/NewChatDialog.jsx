import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { toast } from "../../hooks/use-toast";

export function NewChatDialog({ open, onOpenChange }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Debounced search
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery.trim());
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, open]);

  const performSearch = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log('Searching for users with query:', query);
      const response = await api.get(`/auth/users/search`, {
        params: { q: query, limit: 10 }
      });

      console.log('Search response:', response.data);
      
      if (response.data && response.data.success) {
        const results = response.data.data || [];
        console.log('Search results:', results);
        setSearchResults(results);
        
        // If no results, log for debugging
        if (results.length === 0) {
          console.log('No users found matching query:', query);
        }
      } else {
        console.warn('Search response not successful:', response.data);
        setSearchResults([]);
      }
    } catch (error) {
      // Handle 401 errors - token expired or invalid
      if (error.response?.status === 401) {
        console.error('Authentication error during user search:', error);
        // Check if this was after a retry (token refresh failed)
        if (error.config?._retry) {
          // Token refresh failed - user needs to log in again
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please log in again to continue.",
            variant: "destructive",
          });
          setSearchResults([]);
          // Redirect to login after a short delay
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }
        
        // If we get here, the interceptor should have tried to refresh
        // But if it didn't work, we'll show a message
        // The interceptor will retry automatically, so we just clear results
        setSearchResults([]);
        return;
      }
      
      // Handle network errors
      if (!error.response) {
        console.error('Network error during user search:', error);
        toast({
          title: "Connection Error",
          description: "Unable to connect to server. Please check your connection.",
          variant: "destructive",
        });
        setSearchResults([]);
        return;
      }
      
      // Handle other errors
      console.error('Error searching users:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      toast({
        title: "Error",
        description: error.response?.data?.message || error.response?.data?.error || "Failed to search users. Please try again.",
        variant: "destructive",
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = async (peerId, peerEmail) => {
    try {
      // Call backend API to get or create session
      // This ensures we always get the same session ID for the same user pair
      const api = (await import('../../services/api')).default;
      
      console.log(`[NewChatDialog] Getting or creating session for users ${user.id} ↔ ${peerId}`);
      
      const response = await api.post('/sessions', {
        userId1: user.id,
        userId2: peerId
      });
      
      if (response.data.success) {
        const { session, isNew } = response.data.data;
        
        if (isNew) {
          console.log(`[NewChatDialog] ✓ NEW session created: ${session.sessionId}`);
        } else {
          console.log(`[NewChatDialog] ✓ EXISTING session found: ${session.sessionId} (created: ${session.createdAt})`);
        }
        
        // Navigate to chat with the session ID from backend
        navigate(`/chat/${session.sessionId}`, {
          state: { peerId, peerEmail }
        });
      } else {
        throw new Error(response.data.error || 'Failed to get or create session');
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('[NewChatDialog] Error starting chat:', error);
      toast({
        title: "Error",
        description: error.response?.data?.message || error.message || "Failed to start conversation. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start New Conversation</DialogTitle>
          <DialogDescription>
            Search for a user by email address to start a new encrypted conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email..."
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Search Results */}
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isSearching && searchQuery.trim().length < 2 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            )}

            {!isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No users found
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleStartChat(result.id, result.email)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">
                        {result.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

