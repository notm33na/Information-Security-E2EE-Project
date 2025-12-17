# Replay Attack Simulation Guide

**Educational Purpose Only** - This guide explains how to use the replay attack simulation tools to understand and demonstrate replay protection mechanisms.

## Quick Start

### One-Command Solution

After logging into the application, simply run:

```bash
npm run replay-attack -- --email your@email.com --password YourPass123!
```

Or using direct node:

```bash
node scripts/run-replay-attack-simulation.js your@email.com YourPass123!
```

The script will:

1. Login automatically
2. Enable attack mode
3. Wait for you to send messages (10 seconds)
4. Capture messages automatically
5. Run the attack simulation
6. Display detailed results

## Prerequisites

1. **Server running**: Make sure the backend server is running
2. **Logged in to app**: You should be logged into the web application (to send messages)
3. **Node.js installed**: Required to run the script

## Configuration

### Enable Attack Mode

Set the environment variable in `.env`:

```env
REPLAY_ATTACK_MODE=true
```

Or enable via API (requires authentication):

```bash
curl -X POST https://localhost:8443/api/replay-attack/toggle \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

### Network IP Configuration

If your server is running on a network IP (not localhost):

```bash
# Set environment variable
export API_URL="https://192.168.56.1:8443"

# Then run the script
npm run replay-attack -- --email your@email.com --password YourPass123!
```

## Attack Types

The simulator supports multiple attack types:

### 1. Exact Replay (`exact`)

Replay the exact same message envelope:

- Same nonce
- Same timestamp
- Same sequence number

**Protection**: Nonce uniqueness check

### 2. Stale Timestamp (`stale-timestamp`)

Replay a message with an old timestamp:

- Different timestamp (old)
- Same or different nonce

**Protection**: Timestamp freshness check

### 3. Duplicate Nonce (`duplicate-nonce`)

Replay a message with the same nonce:

- Same nonce
- Different timestamp/sequence

**Protection**: Nonce uniqueness check

### 4. Out-of-Order Sequence (`out-of-order-seq`)

Replay a message with an old sequence number:

- Old sequence number
- Same or different nonce/timestamp

**Protection**: Sequence monotonicity check

## Usage Examples

### Basic Usage

```bash
npm run replay-attack -- --email test@example.com --password Test123!
```

### Specific Attack Type

```bash
npm run replay-attack -- --email test@example.com --password Test123! --attack-type stale-timestamp
```

### Using Existing Token

```bash
npm run replay-attack -- --token YOUR_TOKEN_HERE
```

### Specific Session

```bash
npm run replay-attack -- --token YOUR_TOKEN --session session-123
```

## Getting Message IDs

When attack mode is enabled, messages are automatically captured. Get captured messages:

```bash
curl -X GET https://localhost:8443/api/replay-attack/captured/session-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

The response includes `messageId` for each captured message, which follows the format: `sessionId:seq:timestamp`

## Viewing Attack Logs

### Via Application

1. Navigate to `/logs` in the application
2. Filter for "Replay Attacks"
3. View detailed information about each blocked attack

### Via API

```bash
curl -X GET https://localhost:8443/api/logs?eventType=REPLAY_ATTEMPT \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Log Files

- **Client-side**: Browser IndexedDB `security_logs` store
- **Server-side**: MongoDB `security_logs` collection
- **Local files**: `server/logs/replay_attempts.log`

## Understanding Protection Mechanisms

### Nonce Uniqueness

- **Purpose**: Ensure message uniqueness
- **Implementation**: 16-byte random nonce per message
- **Protection**: Prevents exact message replay

### Timestamp Freshness

- **Purpose**: Ensure message freshness
- **Implementation**: Timestamp in each message, validated within 2-minute window
- **Protection**: Prevents stale message replay

### Sequence Monotonicity

- **Purpose**: Ensure strict ordering
- **Implementation**: Sequence number per message, must be strictly increasing
- **Protection**: Prevents out-of-order replay

### Message ID Uniqueness

- **Purpose**: Server-side deduplication
- **Implementation**: `messageId = sessionId:seq:timestamp`
- **Protection**: Additional server-side check

## Expected Behavior

### Attacks Should Be Blocked

All replay attacks should be **blocked** by the protection mechanisms:

- Nonce uniqueness: Immediate detection
- Timestamp freshness: Detects stale messages
- Sequence monotonicity: Detects out-of-order messages

### Logs Should Be Created

Each blocked attack creates a log entry with:

- Session ID
- Sequence Number
- Message Timestamp
- Reason for rejection
- Protection mechanism that blocked it

### No Message Processing

Blocked replay attacks should:

- **Not decrypt** the message
- **Not display** the message
- **Not update** session state

## Troubleshooting

### No Captured Messages

- Ensure attack mode is enabled (`REPLAY_ATTACK_MODE=true`)
- Send messages after enabling attack mode
- Check server logs for capture confirmation

### Script Fails to Login

- Verify credentials are correct
- Ensure server is running
- Check API URL configuration if using network IP

### Attack Not Detected

- Verify message was actually captured
- Check that protection mechanisms are enabled
- Review server logs for details
