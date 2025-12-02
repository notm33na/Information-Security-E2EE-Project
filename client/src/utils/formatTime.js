/**
 * Formats a timestamp for display in chat lists
 * @param {string|Date|number} timestamp - ISO string, Date object, or timestamp
 * @returns {string} Formatted time string
 */
export function formatChatTimestamp(timestamp) {
  if (!timestamp) return 'Just now';
  
  const date = typeof timestamp === 'string' 
    ? new Date(timestamp) 
    : typeof timestamp === 'number' 
    ? new Date(timestamp) 
    : timestamp;
  
  if (isNaN(date.getTime())) return 'Just now';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  
  // For older dates, show the date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

/**
 * Formats a timestamp for file display
 * @param {string|Date|number} timestamp - ISO string, Date object, or timestamp
 * @returns {string} Formatted date string
 */
export function formatFileTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';
  
  const date = typeof timestamp === 'string' 
    ? new Date(timestamp) 
    : typeof timestamp === 'number' 
    ? new Date(timestamp) 
    : timestamp;
  
  if (isNaN(date.getTime())) return 'Unknown';
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

