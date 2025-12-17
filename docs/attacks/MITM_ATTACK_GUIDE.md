# MITM Attack Simulation Guide

**Educational Purpose Only** - This guide explains how to use the MITM attack simulation tools to understand and demonstrate MITM protection mechanisms.

## Quick Start

### Run the Simulation Script

```bash
npm run mitm-attack -- --email your@email.com --password YourPass123!
```

Or using direct node:

```bash
node scripts/run-mitm-attack-simulation.js your@email.com YourPass123!
```

The script will:

1. Login automatically
2. Enable MITM attack mode
3. Wait for key exchange to occur (15 seconds)
4. Intercept KEP messages automatically
5. Run the attack simulation
6. Display detailed results

## Prerequisites

1. **Server running**: Make sure the backend server is running
2. **Two users**: You need at least two user accounts to create a chat session
3. **Node.js installed**: Required to run the script

## Configuration

### Enable Attack Mode

Set the environment variable in `.env`:

```env
MITM_ATTACK_MODE=true
```

Or enable via API (requires authentication):

```bash
curl -X POST https://localhost:8443/api/mitm-attack/toggle \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

## Triggering Key Exchange

**Important**: Key exchange (KEP) only happens when a **NEW chat session is created**, not when sending messages to an existing session.

### Method 1: Start a New Chat (Easiest)

1. Open the application in your browser
2. Click "New Chat" or start a chat with a **different user** (someone you haven't chatted with before)
3. The key exchange will happen automatically when the new session is created
4. You'll see `[MITM_ATTACK] Intercepting KEP_INIT` in server logs

### Method 2: Delete Existing Session and Recreate

1. Delete the existing session from the application
2. Start a new chat with the same user
3. This will trigger a new key exchange

### Method 3: Use Browser DevTools (Advanced)

1. Open browser DevTools (F12)
2. Go to **Application** → **IndexedDB** → `infosec-db` → `sessions`
3. Delete the session
4. Refresh the chat page - it will automatically re-establish the session with a new key exchange

## Attack Types

The simulator supports multiple attack types:

### 1. Unsigned Intercept (`unsigned`)

Demonstrates vulnerability when ephemeral keys are not signed:

1. Alice sends KEP_INIT with unsigned ephemeral key
2. Attacker intercepts and replaces key with own key
3. Bob receives attacker's key (thinks it's from Alice)
4. Attacker establishes separate sessions with both parties
5. **Attack succeeds** - Attacker can decrypt all messages

**Expected Result**: ✅ Attack Successful

### 2. Signed Intercept (`signed`)

Demonstrates how signatures prevent the attack:

1. Alice sends KEP_INIT with signed ephemeral key
2. Attacker intercepts and tries to replace key
3. Bob verifies signature - **VERIFICATION FAILS**
4. Bob rejects the message
5. **Attack blocked** - No session established

**Expected Result**: ❌ Attack Blocked

### 3. Key Confirmation Mismatch (`key-confirmation`)

Demonstrates how key confirmation prevents MITM even if signatures are bypassed:

1. Attacker intercepts KEP messages
2. Attempts to establish separate sessions
3. Key confirmation values don't match
4. **Attack blocked** - Key confirmation mismatch detected

**Expected Result**: ❌ Attack Blocked

## Usage Examples

### Basic Usage

```bash
npm run mitm-attack -- --email test@example.com --password Test123!
```

### Specific Attack Type

```bash
npm run mitm-attack -- --email test@example.com --password Test123! --attack-type signed
```

### Using Existing Token

```bash
npm run mitm-attack -- --token YOUR_TOKEN_HERE
```

### Specific Session

```bash
npm run mitm-attack -- --token YOUR_TOKEN --session session-123
```

### Increase Wait Time

```bash
npm run mitm-attack -- --email test@example.com --password Test123! --wait 30
```

## What to Look For

When a key exchange occurs, you should see in the **server logs**:

```
[MITM_ATTACK] Intercepting KEP_INIT for session ...
[MITM_ATTACK] KEP_INIT intercepted and stored. Total intercepted sessions: 1
[MITM_ATTACK] Intercepting KEP_RESPONSE for session ...
[MITM_ATTACK] KEP_RESPONSE intercepted and stored. Total intercepted sessions: 1
```

## Expected Output

After running successfully, you should see:

1. **Console Output**: Summary of the attack simulation
2. **Attack Flow**: Step-by-step breakdown of the attack
3. **Result**: Whether the attack succeeded or was blocked
4. **Protection Mechanism**: Which protection prevented the attack (if blocked)

## Viewing Attack Logs

### Via Application

1. Navigate to `/logs` in the application
2. Filter for "Invalid Signature" events
3. View detailed information about each blocked attack

### Via API

```bash
curl -X GET https://localhost:8443/api/logs?eventType=INVALID_SIGNATURE \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Log Files

- **Server-side**: MongoDB `security_logs` collection
- **Local files**: `server/logs/invalid_signature.log`

## Protection Mechanisms

### Digital Signatures

- **Purpose**: Verify authenticity of key exchange messages
- **Implementation**: ECDSA signatures on KEP_INIT and KEP_RESPONSE
- **Protection**: Prevents key substitution attacks

### Key Confirmation

- **Purpose**: Verify both parties derived the same shared secret
- **Implementation**: Key confirmation hash in KEP_RESPONSE
- **Protection**: Prevents MITM even if signatures are bypassed

## Troubleshooting

### "No intercepted KEP messages found"

**Cause**: Key exchange didn't happen during the wait period, or happened before MITM mode was enabled.

**Solution**:

1. Make sure MITM mode is enabled **before** starting a new chat
2. Start a **completely new chat session** (not just refresh)
3. Check server logs for `[MITM_ATTACK]` messages
4. Increase wait time: `--wait 30`

### "Key exchange happened but not intercepted"

**Cause**: MITM mode wasn't enabled when the key exchange occurred.

**Solution**:

1. Enable MITM mode first: Run the script and wait for "MITM attack mode enabled!"
2. **Then** start a new chat session
3. The interception will happen automatically

### Script Fails to Login

- Verify credentials are correct
- Ensure server is running
- Check API URL configuration if using network IP

## Running Tests

You can also run MITM attack tests:

```bash
cd client
npm run test:attacks -- mitm_attack_demonstration.test.js
```

## Code References

### Attacker Scripts

- `client/src/attacks/mitmAttacker.js` - MITM attack implementation
- `client/src/attacks/mitmSimulator.js` - Attack simulation

### Signature Implementation

- `client/src/crypto/signatures.js` - Signature operations
- `client/src/crypto/messages.js` - KEP message building/validation

### Backend Simulation

- `server/src/services/mitmAttackSimulator.js` - Backend MITM simulation
- `server/src/controllers/mitmAttack.controller.js` - API endpoints
