# Nonce Validation Implementation

## Purpose

This document describes the implementation of nonce validation in the E2EE messaging system. Nonces are now treated as first-class replay-protection primitives alongside timestamps, sequence numbers, and message IDs. The goal is to ensure that every encrypted message (and KEP message) is uniquely identifiable at the cryptographic metadata level, and that any attempt to reuse a nonce within the same session is detected and rejected on both the client and server.

## Architecture Overview

- **Nonce Source**:
  - Nonces are generated in the client using `generateNonce(16)` (16 bytes of cryptographically random data) and are included in KEP messages and encrypted message envelopes via `generateTimestamp()`.
  - They are transmitted as base64-encoded strings (`nonce`) in the envelope.
- **Client-Side Enforcement**:
  - The client decodes the nonce, verifies its length (12–32 bytes), computes `SHA-256(nonce)` and tracks the last 200 nonce hashes per session in IndexedDB (`usedNonceHashes`).
  - Incoming messages whose nonce is missing, malformed, or already seen in the same session are rejected before decryption and logged as replay attempts.
- **Server-Side Enforcement**:
  - The server validates nonce presence and length, computes `nonceHash = SHA-256(nonce)` and stores it in `MessageMeta`.
  - MongoDB enforces a compound unique index `{ sessionId: 1, nonceHash: 1 }`, rejecting any reuse of a nonce within the same session and logging this as a replay event.

## Client Logic

### Generation

- Nonces are generated in `client/src/crypto/messages.js`:
  - `generateNonce(length = 16)` uses `crypto.getRandomValues(new Uint8Array(length))`.
  - `generateTimestamp()` returns `{ timestamp: Date.now(), nonce: generateNonce() }`.
- Message envelopes are built in `client/src/crypto/messageEnvelope.js`:
  - `buildTextMessageEnvelope`, `buildFileMetaEnvelope`, and `buildFileChunkEnvelope` call `generateTimestamp()` and include the nonce as a base64 string (`nonce: arrayBufferToBase64(nonce)`).

### Storage in Sessions

- The session manager (`client/src/crypto/sessionManager.js`) now maintains nonce usage metadata:
  - The `createSession` function initializes sessions with:
    - `usedNonceHashes: []` — an array of hex-encoded `SHA-256(nonce)` values.
  - Session records are stored in the `sessions` object store in IndexedDB (`InfosecCryptoDB`).
  - Two new exported helpers manage nonce hashes per session:
    - `isNonceUsed(sessionId, nonceHash)`:
      - Reads the session record from IndexedDB.
      - Returns `true` if `nonceHash` is present in `usedNonceHashes`, otherwise `false`.
    - `storeUsedNonce(sessionId, nonceHash)`:
      - Reads the session record from IndexedDB.
      - Appends `nonceHash` to `usedNonceHashes` if it is not already present.
      - Trims the array to at most 200 entries (keeps the most recent 200) to bound storage.
      - Writes the updated session back to IndexedDB without touching encrypted key material.

### Validation Path (Before Decryption)

- Incoming message handling in `client/src/crypto/messageFlow.js` has been extended:
  1. **Structure Validation**:
     - `validateEnvelopeStructure(envelope)` ensures required fields exist and base64 fields are strings.
  2. **Timestamp Validation**:
     - `validateTimestamp(envelope.timestamp, 120000)` enforces the ±2-minute acceptance window.
  3. **Sequence Validation**:
     - `sequenceManager.validateSequence(envelope.sessionId, envelope.seq)` enforces strictly increasing sequence numbers.
  4. **Nonce Validation (New)**:
     - Rejects if `envelope.nonce` is missing.
     - Decodes `envelope.nonce` from base64 to an `ArrayBuffer`; rejects if decoded length is not between 12 and 32 bytes.
     - Computes `nonceHash = SHA-256(nonceBytes)` via Web Crypto API and hex-encodes the result.
     - Calls `isNonceUsed(envelope.sessionId, nonceHash)`:
       - If `true`, rejects the message as a replay attempt (“Duplicate nonce for this session”), logs locally, and triggers `triggerReplayDetection`.
  5. **Decryption and State Update**:
     - If all checks pass, the message is decrypted with `decryptAESGCM`/`decryptAESGCMToString` using `recvKey`.
     - `updateSessionSeq(envelope.sessionId, envelope.seq, userId)` updates the stored `lastSeq`.
     - `storeUsedNonce(envelope.sessionId, nonceHash)` records the nonce hash in the session metadata (bounded to 200 entries).

## Server Logic

### Replay Utilities

- `server/src/utils/replayProtection.js` now exports:
  - `hashNonceBase64(nonceBase64, minLength = 12, maxLength = 32)`:
    - Ensures `nonceBase64` is a non-empty string.
    - Decodes it with `Buffer.from(nonceBase64, 'base64')`.
    - Verifies decoded length is between `minLength` and `maxLength` (default 12–32 bytes).
    - Computes and returns `SHA-256(nonce)` as a hex string using Node `crypto`.
  - Existing helpers `validateTimestamp` and `generateMessageId` are unchanged.

### Metadata Model and Indexes

- `server/src/models/MessageMeta.js` has been extended:
  - New field:
    - `nonceHash: { type: String, index: true }`.
  - New compound unique index:
    - `messageMetaSchema.index({ sessionId: 1, nonceHash: 1 }, { unique: true });`
  - Existing uniqueness constraints on `messageId` and `(sessionId, seq, timestamp)` remain in place.

### REST Relay Path

- In `server/src/controllers/messages.controller.js`:
  - After timestamp validation, the controller now performs:
    - `const nonceHash = hashNonceBase64(envelope.nonce);`
    - If this throws (missing or malformed nonce), the server:
      - Logs the replay attempt with `logReplayAttempt(envelope.sessionId, envelope.seq, envelope.timestamp, reason)`.
      - Responds with HTTP 400 and `error: reason`.
  - When constructing `MessageMeta`, it includes `nonceHash`:
    - `nonceHash` is persisted alongside `messageId`, `sessionId`, `sender`, `receiver`, `type`, `timestamp`, and `seq`.
  - If `messageMeta.save()` fails with `error.code === 11000`:
    - The controller interprets this as a replay attempt (duplicate `messageId` or `nonceHash`) and logs with reason:
      - `"REPLAY_REJECT: Duplicate nonce detected"`.
    - Responds with HTTP 400 and the same reason string.

### WebSocket Path (`msg:send`)

- In `server/src/websocket/socket-handler.js`, the `msg:send` handler now:
  1. Validates required fields (`type`, `sessionId`, `receiver`, `timestamp`, `seq`).
  2. Validates timestamp with `validateTimestamp(timestamp)`, logging and rejecting stale/future messages as before.
  3. Validates and hashes nonce:
     - Calls `hashNonceBase64(envelope.nonce)`.
     - On error, logs via `logReplayAttempt` and `logReplayDetected`, and emits an error event back to the client with the reason.
  4. Generates `messageId = generateMessageId(sessionId, seq, timestamp)` and constructs `MessageMeta` including `nonceHash`.
  5. Saves `MessageMeta` and forwards the envelope to the recipient if online.
  6. On `error.code === 11000`:
     - Treats this as a replay attempt (duplicate `messageId` or `nonceHash`).
     - Logs with reason `"REPLAY_REJECT: Duplicate nonce detected"` using both `logReplayAttempt` and `logReplayDetected`.
     - Emits an error back to the sender indicating the message was rejected as a duplicate replay.

## Database Schema Changes

- **MessageMeta Schema**:
  - Added field:
    - `nonceHash: String` (indexed).
  - Added compound unique index:
    - `{ sessionId: 1, nonceHash: 1 }` with `{ unique: true }`.
  - Existing indexes on `messageId`, `sessionId`, `seq`, `timestamp`, and other fields remain.
  - No migration is required for existing documents; `nonceHash` is simply absent for historical records and required for new metadata.

## Tests

- New test file: `server/tests/replay/nonceValidation.test.js`
  - **Missing nonce**:
    - Asserts that `hashNonceBase64(undefined | null | '')` throws, ensuring the server refuses envelopes without a nonce.
  - **Malformed nonce (too short)**:
    - Uses a base64 string (`"AA=="`) that decodes to a single byte and verifies `hashNonceBase64` throws with an “Invalid nonce length” error.
  - **Legitimate nonce**:
    - Generates a 16-byte random nonce, computes `nonceHash`, and confirms that saving a `MessageMeta` document with that `nonceHash` and a unique `messageId` succeeds.
  - **Reused nonce**:
    - Creates two `MessageMeta` documents for the same `sessionId` and identical `nonceHash` but different `seq`/`timestamp`, and asserts that the second save is rejected due to the unique `{ sessionId, nonceHash }` index.

## Example Attack and Rejection Logs

### Duplicate Nonce Replay (Server)

- **Scenario**:
  - An attacker captures an encrypted envelope and replays it verbatim for the same `sessionId`.
  - The server computes the same `nonceHash` and attempts to insert a `MessageMeta` document with identical `(sessionId, nonceHash)`.
- **Outcome**:
  - MongoDB raises a duplicate-key error on the `{ sessionId, nonceHash }` index.
  - The server logs a replay attempt with reason:
    - `"REPLAY_REJECT: Duplicate nonce detected"`.
  - The sender receives an error response or WebSocket error indicating the message was rejected as a replay.

### Client-Side Replay Detection

- **Scenario**:
  - A replayed envelope reaches the client (e.g., due to network issues or malicious relay).
  - The envelope’s nonce has already been recorded in `usedNonceHashes` for the relevant session.
- **Outcome**:
  - `handleIncomingMessage` detects that `isNonceUsed(sessionId, nonceHash)` is `true`.
  - The message is rejected before decryption with error “Duplicate nonce for this session”.
  - A client-side replay log entry is written, and `triggerReplayDetection` is invoked so higher-level components can react (e.g., warn the user or send telemetry to the server).

## Summary

Nonce validation and tracking now provide an additional replay-protection layer:

- **Client-Side**:
  - Enforces nonce presence and correct size.
  - Tracks recent nonce hashes per session in IndexedDB and rejects duplicates before decryption.
- **Server-Side**:
  - Enforces nonce presence and size.
  - Stores `nonceHash` in `MessageMeta` and prevents reuse per session via a compound unique index.
- **Defense-in-Depth**:
  - Complements existing timestamp and sequence checks, plus `messageId` and `(sessionId, seq, timestamp)` uniqueness constraints.
  - Makes it significantly harder to successfully replay ciphertext, even if an attacker can manipulate timestamps or sequence numbers.


