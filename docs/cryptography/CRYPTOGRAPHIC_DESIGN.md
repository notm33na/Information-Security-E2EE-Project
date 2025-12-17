# Cryptographic Design

**Version:** 1.0  
**Last Updated:** 2025-01-27  
**Status:** Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Key Materials](#key-materials)
3. [Key Generation Process](#key-generation-process)
4. [Key Generation Diagram](#key-generation-diagram)
5. [Security Considerations](#security-considerations)
6. [Missing Details](#missing-details)

---

## Overview

This document describes the complete cryptographic architecture for the end-to-end encrypted messaging system. The implementation uses only native Web Crypto API (browser) and Node.js crypto modules—no external E2EE libraries are used.

The system provides:

- **Identity Key Pairs**: Long-lived ECC P-256 keys for signing ephemeral keys and establishing cryptographic identity
- **Ephemeral Key Exchange**: Authenticated ECDH protocol for session establishment with forward secrecy
- **Session Key Derivation**: HKDF-based key derivation for secure message encryption
- **Secure Storage**: IndexedDB with password-based encryption for private keys
- **Replay Protection**: Timestamp, nonce, and sequence number validation

All cryptographic operations are performed client-side. The server acts as a relay for encrypted messages and public keys, but cannot decrypt any content.

---

## Key Materials

### Identity Keys

**Purpose**: Long-term cryptographic identity used for signing ephemeral keys during key exchange.

**Type**: ECC P-256 (prime256v1) using ECDSA

**Properties**:

- Algorithm: ECDSA
- Curve: P-256
- Key size: 256 bits
- Private key extractable: `true` (required for encrypted storage)
- Public key extractable: `true` (required for JWK export)
- Usages: `['sign']` for private key, `['verify']` for public key

**Storage**:

- Private key: Encrypted in IndexedDB using AES-GCM with password-derived key
- Public key: Stored on server in MongoDB `PublicKey` collection (plaintext, by design)

**Lifecycle**:

- Generated once per user during registration
- Loaded into memory on each login (decrypted with password)
- Used for signing ephemeral keys and key update messages
- Rotation recommended after 90 days (optional, on-demand)

### Ephemeral Keys

**Purpose**: Short-lived keys used for ECDH key exchange to establish session keys.

**Type**: ECDH P-256

**Properties**:

- Algorithm: ECDH
- Curve: P-256
- Generated per session during key exchange protocol
- Stored in memory only (never persisted)
- Discarded immediately after shared secret computation

**Lifecycle**:

- Generated during key exchange protocol (KEP)
- Single-use (discarded after session establishment)
- Can be rotated periodically for forward secrecy
- Provides forward secrecy: compromised keys cannot decrypt past messages

### Session Keys

**Purpose**: Derived keys used for encrypting and decrypting messages.

**Derivation**: HKDF-SHA256 from ECDH shared secret

**Key Types**:

- **Root Key**: 256 bits, derived from shared secret
- **Send Key**: 256 bits, derived from root key (for outgoing messages)
- **Receive Key**: 256 bits, derived from root key (for incoming messages)

**Storage**:

- Encrypted in IndexedDB using AES-GCM with password-derived key
- Cached in memory during active sessions
- Session encryption key cache expires after 1 hour

**Usage**:

- Send key: Encrypts outgoing messages (AES-256-GCM)
- Receive key: Decrypts incoming messages (AES-256-GCM)
- Keys remain valid until session ends or key rotation occurs

---

## Key Generation Process

### Registration Flow

1. **User Registration**:

   - User completes registration form (email, password)
   - Client-side JavaScript calls `crypto.subtle.generateKey()` with ECC P-256 parameters

2. **Identity Key Generation**:

   - Web Crypto API generates ECC P-256 key pair using ECDSA
   - Algorithm: `{name: 'ECDSA', namedCurve: 'P-256'}`
   - Keys are extractable: `true`
   - Usages: `['sign', 'verify']`

3. **Private Key Storage**:

   - Export private key to JWK format: `crypto.subtle.exportKey('jwk', privateKey)`
   - Serialize JWK to ArrayBuffer (UTF-8 encoding)
   - Generate random salt: 16 bytes using `crypto.getRandomValues()`
   - Generate random IV: 12 bytes (96 bits) for AES-GCM
   - Derive encryption key: `PBKDF2(password, salt, 100000, SHA-256)` → 256-bit AES-GCM key
   - Encrypt private key: `AES-GCM(encryptionKey, iv, jwkData)`
   - Store in IndexedDB: `InfosecCryptoDB.identityKeys` with structure:
     ```
     {
       userId: string,
       encryptedData: Uint8Array,
       salt: Uint8Array (16 bytes),
       iv: Uint8Array (12 bytes),
       createdAt: ISO string
     }
     ```

4. **Public Key Export**:

   - Export public key to JWK format: `crypto.subtle.exportKey('jwk', publicKey)`
   - JWK format: `{kty: "EC", crv: "P-256", x: <base64>, y: <base64>}`

5. **Public Key Upload**:
   - Send JWK to server via `POST /api/keys/upload`
   - Requires authenticated user (JWT token)
   - Server validates key format (must be EC P-256, no private key component)
   - Server stores in MongoDB `PublicKey` collection:
     ```
     {
       userId: ObjectId,
       publicIdentityKeyJWK: JWK object,
       keyHash: SHA-256 hash,
       version: number,
       createdAt: Date,
       updatedAt: Date
     }
     ```

### Session Establishment Flow

1. **Key Exchange Initiation**:

   - Initiator fetches peer's identity public key from server: `GET /api/keys/:peerId`
   - Server returns public key in JWK format

2. **Ephemeral Key Generation**:

   - Generate ephemeral ECDH key pair: `crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveKey'])`
   - Export ephemeral public key to JWK format
   - Keep ephemeral private key in memory (not stored)

3. **Ephemeral Key Signing**:

   - Sign ephemeral public key with identity private key
   - Algorithm: `{name: "ECDSA", hash: "SHA-256"}`
   - Data signed: `JSON.stringify(ephemeralPublicKeyJWK)`
   - Signature: Base64-encoded

4. **KEP_INIT Message**:

   - Create message with signed ephemeral public key
   - Include timestamp, nonce (16 bytes), sequence number
   - Send via WebSocket: `socket.emit("kep:init", message)`

5. **Key Exchange Response**:

   - Responder verifies timestamp (±2 minutes window)
   - Verifies signature using initiator's identity public key
   - Generates own ephemeral key pair
   - Computes shared secret: `ECDH(ephemeralPrivateKey, peerEphemeralPublicKey)`
   - Derives session keys using HKDF
   - Generates key confirmation HMAC
   - Signs own ephemeral public key
   - Sends KEP_RESPONSE message

6. **Session Key Derivation**:

   - Both parties compute shared secret via ECDH (256 bits)
   - Derive root key: `HKDF(sharedSecret, salt="ROOT", info=sessionId, length=256 bits, hash=SHA-256)`
   - Derive send key: `HKDF(rootKey, salt="SEND", info=userId, length=256 bits, hash=SHA-256)`
   - Derive receive key: `HKDF(rootKey, salt="RECV", info=peerId, length=256 bits, hash=SHA-256)`

7. **Key Confirmation**:

   - Responder computes: `HMAC-SHA256(rootKey, "CONFIRM:" + initiatorUserId)`
   - Initiator verifies key confirmation matches computed value
   - If match: Session established
   - If mismatch: Session rejected, keys discarded

8. **Session Storage**:
   - Encrypt session keys (rootKey, sendKey, recvKey) using password-derived key
   - Store encrypted session in IndexedDB: `InfosecCryptoDB.sessions`
   - Session structure:
     ```
     {
       sessionId: string,
       userId: string,
       peerId: string,
       rootKey: {encrypted, iv, authTag},
       sendKey: {encrypted, iv, authTag},
       recvKey: {encrypted, iv, authTag},
       lastSeq: number,
       lastTimestamp: number,
       createdAt: ISO string,
       updatedAt: ISO string,
       encrypted: true
     }
     ```

---
