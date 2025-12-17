# Encryption & Decryption Workflows

---

## Overview

This document provides complete visual and textual documentation of the encryption and decryption workflows for the E2EE messaging system. All workflows are based strictly on the information present in the project documentation.

**Key Features:**

- AES-256-GCM encryption for all messages
- File encryption with 256KB chunking
- Client-side encryption/decryption only
- Server acts as relay (never sees plaintext)
- Multi-layer replay protection
- Metadata-only server storage

---

## Encryption Workflow

1. **User Input**: User types a text message or selects a file to send.

2. **Load Session Keys**: Client loads the sendKey from IndexedDB using the sessionId. The sendKey is a 256-bit key derived from the ECDH key exchange protocol.

3. **Prepare Plaintext**: For text messages, convert the plaintext string to an ArrayBuffer. For files, read the file as an ArrayBuffer and optionally chunk it into 256KB pieces.

4. **Generate Initialization Vector (IV)**: Generate a unique 96-bit (12 bytes) cryptographically random IV using `crypto.getRandomValues()`. Each message must use a unique IV.

5. **Import Encryption Key**: Import the sendKey as a CryptoKey object with algorithm `{ name: 'AES-GCM' }` for use with Web Crypto API.

6. **Encrypt with AES-256-GCM**: Perform encryption using `crypto.subtle.encrypt()` with:

   - Algorithm: AES-GCM
   - Key: sendKey (256-bit)
   - IV: 96-bit random IV
   - Tag Length: 128 bits

7. **Extract Ciphertext and Auth Tag**: The encryption result contains both ciphertext and authentication tag. Extract ciphertext as `encrypted.slice(0, -16)` and authTag as `encrypted.slice(-16)` (last 16 bytes).

8. **Build Message Envelope**: Create a JSON envelope containing:

   - `type`: "MSG" for text or "FILE_META"/"FILE_CHUNK" for files
   - `sessionId`, `sender`, `receiver`: Session and participant identifiers
   - `ciphertext`, `iv`, `authTag`: Base64-encoded encryption components
   - `timestamp`: Current time in milliseconds
   - `seq`: Sequence number (strictly increasing)
   - `nonce`: Random nonce for replay protection

9. **Send via WebSocket**: Transmit the envelope to the server using `socket.emit('msg:send', envelope)` over a secure WebSocket connection (WSS).

10. **Server Validation**: Server validates the timestamp is within ±2 minutes of current time to prevent replay attacks.

11. **Server Metadata Storage**: Server stores only metadata (sender, receiver, timestamp, seq, type) in MongoDB. The server never stores ciphertext, IV, authTag, or nonce.

12. **Server Relay**: Server forwards the complete envelope to the intended receiver via WebSocket. The server acts as a relay and cannot decrypt the message content.

13. **File-Specific Steps** (if applicable): For files, first send a FILE_META envelope with encrypted file metadata (filename, size, totalChunks, mimetype), then send FILE_CHUNK envelopes sequentially for each encrypted chunk.

14. **Delivery Confirmation**: The envelope is delivered to the receiver's WebSocket connection, ready for decryption.

---

## Decryption Workflow

1. **Receive Envelope**: Receiver receives the encrypted message envelope via WebSocket event `socket.on('msg:receive', envelope)`.

2. **Structure Validation (Layer 1)**: Validate the envelope structure:

   - Check all required fields are present
   - Verify message type is valid ("MSG", "FILE_META", or "FILE_CHUNK")
   - Validate base64 encoding format is correct

3. **Timestamp Freshness Check (Layer 2)**: Calculate message age: `age = Date.now() - envelope.timestamp`. If `Math.abs(age) > 120000` (2 minutes), reject the message as a potential replay attack.

4. **Sequence Number Validation (Layer 3)**: Load the last processed sequence number for this session from IndexedDB. If `envelope.seq <= lastSeq`, reject the message as a replay or out-of-order message. Sequence numbers must be strictly increasing.

5. **Load Receive Key**: Retrieve the recvKey from IndexedDB using `getRecvKey(sessionId)`. The recvKey is the 256-bit key used for decrypting incoming messages in this session.

6. **Decode Base64 Components**: Decode the base64-encoded fields:

   - `ciphertext` → ArrayBuffer
   - `iv` → Uint8Array (12 bytes)
   - `authTag` → ArrayBuffer (16 bytes)

7. **Combine Ciphertext and Auth Tag**: Create a single ArrayBuffer containing both ciphertext and authTag, as required by Web Crypto API for AES-GCM decryption.

8. **Import Decryption Key**: Import the recvKey as a CryptoKey object with algorithm `{ name: 'AES-GCM' }` for use with Web Crypto API.

9. **Decrypt with AES-256-GCM**: Perform decryption using `crypto.subtle.decrypt()` with:

   - Algorithm: AES-GCM
   - Key: recvKey (256-bit)
   - IV: from envelope (96 bits)
   - Tag Length: 128 bits

10. **Authentication Tag Verification**: During decryption, AES-GCM automatically verifies the authentication tag. If the tag is invalid (message was tampered with), decryption throws an `OperationError` and the process stops.

11. **Recover Plaintext**: If decryption succeeds, the plaintext is recovered as an ArrayBuffer. For text messages, convert to UTF-8 string. For files, the ArrayBuffer represents a decrypted chunk.

12. **Update Session State**: Update the session's last sequence number in IndexedDB using `updateSessionSeq(sessionId, envelope.seq)` to prevent replay of this message.

13. **File Reconstruction** (if applicable): For file messages, collect all FILE_CHUNK envelopes, decrypt each chunk, sort by chunkIndex, and combine into a single ArrayBuffer. Create a Blob with the correct mimetype for download.

14. **Render to User**: Display the decrypted message in the chat UI or provide a download button for files. The plaintext is now visible to the user, having been decrypted entirely client-side.

---
