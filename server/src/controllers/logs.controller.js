import { SecurityLog } from '../models/SecurityLog.js';

/**
 * Get security logs
 * GET /api/logs
 * Query params:
 *   - eventType: Filter by event type
 *   - userId: Filter by user ID (only own logs unless admin)
 *   - sessionId: Filter by session ID
 *   - limit: Maximum number of logs to return (default: 100)
 *   - startDate: Start date for filtering
 *   - endDate: End date for filtering
 */
export async function getSecurityLogs(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { eventType, userId, sessionId, limit = 100, startDate, endDate } = req.query;

    // Build query
    const query = {};

    // Users can only see their own logs unless they're admin (for now, all authenticated users can see their own)
    if (userId) {
      // Only allow users to query their own logs
      if (String(userId) !== String(req.user.id)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only view your own logs'
        });
      }
      query.userId = userId;
    } else {
      // If no userId specified, default to current user's logs
      query.userId = req.user.id;
    }

    if (eventType) {
      query.eventType = eventType;
    }

    if (sessionId) {
      query.sessionId = sessionId;
    }

    // Date range filtering
    if (startDate || endDate) {
      query.loggedAt = {};
      if (startDate) {
        query.loggedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.loggedAt.$lte = new Date(endDate);
      }
    }

    // Fetch logs from MongoDB
    const logs = await SecurityLog.find(query)
      .populate('userId', 'email')
      .populate('fromUserId', 'email')
      .populate('toUserId', 'email')
      .sort({ loggedAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Transform logs to frontend format
    const transformedLogs = logs.map(log => {
      // Determine log level based on event type and success status
      let level = 'info';
      let title = log.eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      let message = log.reason || `Event: ${log.eventType}`;

      switch (log.eventType) {
        case 'AUTH_ATTEMPT':
          level = log.success ? 'success' : 'error';
          title = log.success ? 'Authentication Success' : 'Authentication Failed';
          message = log.reason || (log.success ? 'Login successful' : 'Login failed');
          if (log.ip) message += ` (IP: ${log.ip})`;
          break;
        case 'KEY_EXCHANGE':
          level = log.success ? 'success' : 'error';
          title = log.success ? 'Key Exchange Success' : 'Key Exchange Failed';
          message = `${log.messageType || 'Key exchange'} ${log.success ? 'succeeded' : 'failed'}`;
          if (log.fromUserId && log.toUserId) {
            message += ` (${log.fromUserId.email || log.fromUserId} → ${log.toUserId.email || log.toUserId})`;
          }
          break;
        case 'DECRYPTION_FAILED':
          level = 'error';
          title = 'Decryption Failed';
          message = `Decryption failed: ${log.reason || 'Decryption error'}`;
          if (log.seq !== null && log.seq !== undefined) message += ` (seq: ${log.seq})`;
          if (log.sessionId) message += ` (session: ${log.sessionId.substring(0, 8)}...)`;
          break;
        case 'REPLAY_ATTEMPT':
          level = 'warning';
          title = 'Replay Attempt Detected';
          message = `Replay attempt: ${log.reason || 'Duplicate message detected'}`;
          if (log.seq !== null && log.seq !== undefined) message += ` (seq: ${log.seq})`;
          if (log.ip) message += ` (IP: ${log.ip})`;
          break;
        case 'INVALID_SIGNATURE':
          // Check if this is a MITM attack simulation
          if (log.metadata?.isSimulation && log.metadata?.attackType) {
            level = log.metadata.flow?.result?.success ? 'error' : 'warning';
            title = 'MITM Attack Simulation';
            message = `MITM attack ${log.metadata.flow?.result?.success ? 'SUCCEEDED' : 'BLOCKED'}: ${log.metadata.attackType}`;
            if (log.metadata.flow?.result?.reason) {
              message += ` - ${log.metadata.flow.result.reason}`;
            }
          } else {
            level = 'error';
            title = 'Invalid Signature';
            message = `Signature verification failed: ${log.reason || 'Invalid signature'}`;
            if (log.messageType) message += ` (Message: ${log.messageType})`;
          }
          break;
        case 'METADATA_ACCESS':
          level = 'info';
          title = 'Metadata Access';
          message = `Metadata ${log.action || 'accessed'}`;
          if (log.sessionId) message += ` (session: ${log.sessionId.substring(0, 8)}...)`;
          break;
        case 'INVALID_KEP_MESSAGE':
          level = 'error';
          title = 'Invalid KEP Message';
          message = `Invalid key exchange message: ${log.reason || 'Validation failed'}`;
          break;
        default:
          level = 'info';
          title = log.eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          message = log.reason || `Event: ${log.eventType}`;
      }

      return {
        id: log._id.toString(),
        title,
        message,
        level,
        timestamp: log.loggedAt || log.createdAt || new Date(),
        source: 'Server',
        sessionId: log.sessionId,
        eventType: log.eventType.toLowerCase(), // Normalize to lowercase for frontend consistency
        userId: log.userId?._id?.toString() || log.userId?.toString() || null,
        userEmail: log.userId?.email || null,
        metadata: {
          ...log.metadata,
          success: log.success,
          reason: log.reason,
          ip: log.ip,
          seq: log.seq,
          messageType: log.messageType,
          action: log.action
        }
      };
    });

    res.json({
      success: true,
      data: {
        logs: transformedLogs,
        total: transformedLogs.length
      }
    });
  } catch (error) {
    next(error);
  }
}

