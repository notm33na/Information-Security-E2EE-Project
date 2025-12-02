# Attack Demonstrations

## Replay Attack Defense

### Explanation

This end-to-end encrypted (E2EE) messaging system defends against replay attacks by treating each encrypted envelope and each key exchange message as a time-bounded, sequence-checked event. A replay attack occurs when an adversary captures a valid, previously authenticated message and later re-injects it into the system, attempting to make the receiver or server accept stale or duplicated content. Because the server is intentionally designed as a metadata-only relay and cannot decrypt ciphertext, replay resistance must be enforced through carefully structured metadata and validation rules on both the server and clients.

The documented defense model combines:

- Timestamp freshness checks with a strict ±2 minute acceptance window for both key exchange (KEP_INIT/KEP_RESPONSE) and normal encrypted message envelopes.
- Strictly increasing sequence numbers per session, persisted client‑side and enforced during decryption.
- Server‑side message ID uniqueness, where a composite identifier `messageId = sessionId:seq:timestamp` is generated and enforced as unique in the database.
- Nonce fields included in KEP and message envelopes for additional replay resilience (though current documentation clarifies that nonces are not yet actively validated).
- Dedicated replay logs on the server (`replay_attempts.log` and related files) to provide auditability and evidence of rejected replays.

Collectively, these mechanisms ensure that re‑sent copies of old messages are rejected at multiple layers (client and server) and that all attempted replays leave an auditable trail without exposing plaintext.

### Technical Breakdown

#### Timestamp Window Logic

- **Acceptance window**:
  - For both KEP messages and encrypted envelopes, the system uses a ±2 minute (120,000 ms) window.
  - On the client, the receiver computes `age = Date.now() - envelope.timestamp` and rejects messages when `Math.abs(age) > 120000`.
  - On the server, incoming envelopes and KEP messages are validated to ensure their timestamps fall inside the same ±2 minute window before any metadata is stored or forwarded.
- **Effects**:
  - Old messages (older than 2 minutes) are rejected as potential replay attempts.
  - Messages from the future (more than 2 minutes ahead of the server/client clock) are also rejected, mitigating clock‑skew‑based attacks.

#### Sequence Number Rules

- **Per‑session monotonic counters**:
  - Every encrypted envelope carries a `seq` field that must be strictly increasing within a session.
  - The receiver tracks `lastSeq` for each session in the client’s IndexedDB `sessions` store.
  - On receipt:
    - If `envelope.seq <= lastSeq`, the message is treated as a replay or out‑of‑order and is rejected.
    - Only if `envelope.seq > lastSeq` does decryption proceed; after successful processing, `lastSeq` is updated to the new value.
- **Key exchange messages**:
  - KEP_INIT uses `seq: 1` and KEP_RESPONSE uses `seq: 2`; documentation states that sequence numbers are strictly increasing per session for the key exchange as well.

#### Nonces

- **Inclusion**:
  - KEP_INIT and KEP_RESPONSE messages include a `nonce` field described as a random nonce for replay protection.
  - Message envelopes (`MSG`, `FILE_META`, `FILE_CHUNK`) also include a `nonce` field in their documented JSON schema, described as a random nonce.
- **Intended purpose**:
  - High‑level design documents describe nonces as cryptographically random values (intended size 16 bytes, base64‑encoded) that add uniqueness and make exact message replays easier to detect.
- **Current behavior**:
  - A later “Missing Details” section clarifies that:
    - Nonces are generated and transmitted, but there is **no implemented client‑side nonce validation**.
    - Replay protection in the current implementation relies primarily on timestamps, sequence numbers, and server‑side message ID uniqueness.

#### Message ID Construction and Uniqueness

- **Server‑generated `messageId`**:
  - When envelopes reach the server, a composite identifier is generated:
    - `messageId = sessionId:seq:timestamp`
  - This `messageId` is not generated on the client; it is constructed server‑side before metadata is stored.
- **Uniqueness constraint**:
  - The MongoDB `messages_meta` collection enforces a uniqueness constraint on `messageId`.
  - If an incoming envelope yields a `messageId` that already exists:
    - The message is rejected as a duplicate (replay).
    - A replay‑related log entry is written (e.g., to `replay_attempts.log` or a dedicated replay‑detected log).

#### Server‑Side Validation and Logging

- **Validation steps** (for each incoming message envelope):
  - Validate timestamp freshness against the ±2 minute window.
  - Generate `messageId = sessionId:seq:timestamp`.
  - Check `messageId` uniqueness in `messages_meta`.
  - Only after these checks:
    - Store metadata only (no ciphertext, IV, authTag, or nonce).
    - Forward the full envelope to the recipient via WebSocket.
- **Replay logging**:
  - Replay attempts are logged to `server/logs/replay_attempts.log` with fields including:
    - `timestamp` (log time),
    - `eventType` (e.g., `REPLAY_ATTEMPT`),
    - `sessionId`, `userId`, `seq`,
    - `reason` (e.g., “Sequence number not monotonic” or “Timestamp out of validity window”),
    - `action` (typically `"REJECTED"`).
  - The documentation also references replay‑specific duplicate detection logs, which capture message‑ID‑based replays.

#### Client‑Side Session State

- **IndexedDB `sessions` store**:
  - Stores per‑session data:
    - `lastSeq` (last accepted sequence number),
    - `lastTimestamp` (last accepted timestamp),
    - encrypted `rootKey`, `sendKey`, and `recvKey`,
    - associated session metadata.
  - The decryption path reads `lastSeq` and `lastTimestamp` before validation and writes updated values only after a message has successfully passed structure, timestamp, and sequence checks.

### Demonstration Instructions

The following steps show how to reproduce and evidence replay protection using the documented application behavior, attack simulator, and logs. All steps assume a **local development environment** (no production data), as recommended in the project documentation.

#### Step 1: Start System and Create Users

1. Start the backend:
   - `cd server`
   - `npm install`
   - `npm run dev`
2. Start the frontend:
   - `cd client`
   - `npm install`
   - `npm run dev`
3. Open the application at `https://localhost:5173` and accept the self‑signed certificate.
4. Register and log in two users:
   - Alice: `alice@test.com` / `SecurePass123!`
   - Bob: `bob@test.com` / `SecurePass123!`
5. Use the chat UI to initiate a secure session between Alice and Bob so that the key exchange protocol completes and session keys are established.

#### Step 2: Send and Capture an Original Message

1. From Alice’s client, send a short test message to Bob (e.g., “Replay test message”).
2. In Alice’s browser:
   - Open DevTools → Network tab → select the WebSocket connection used for messaging.
   - Locate the outgoing `msg:send` frame that corresponds to Alice’s test message.
3. Record the envelope exactly as transmitted, including:
   - `sessionId`, `sender`, `receiver`,
   - `timestamp`, `seq`, `nonce`,
   - `ciphertext`, `iv`, `authTag`.
4. Optionally, export a HAR file from DevTools or capture the same traffic using Wireshark/Burp Suite (filtering on the documented WSS endpoint) and annotate which frame corresponds to the legitimate message.

#### Step 3: Attempt a Raw Replay of the Same Envelope

1. Ensure that Bob has already received and decrypted the original message (it should appear once in his chat UI).
2. Using either a WebSocket testing tool or a small script, **re‑inject the exact same envelope** Alice originally sent:
   - Same `sessionId`, `seq`, and `timestamp`.
   - Same `ciphertext`, `iv`, `authTag`, and `nonce`.
3. Send this replayed payload to the server on the same `msg:send` channel.

#### Step 4: Observe Receiver Behavior

1. On Bob’s UI:
   - Confirm that **no duplicate message** appears in the chat history.
   - The replayed envelope should fail the sequence check (`seq <= lastSeq`) and/or the timestamp window, so it must not be rendered as a new message.
2. In Bob’s browser DevTools (if application logging is enabled):
   - You may see internal indications that an incoming envelope was rejected due to sequence or timestamp validation.
   - **MISSING DETAIL:** The documentation does not specify a particular client‑visible error message or banner for replay rejections; absence of duplication plus server logs is the primary evidence.

#### Step 5: Observe Server Behavior and Logs

1. On the server, open the log directory (as documented) and inspect:
   - `server/logs/replay_attempts.log`
   - Any additional replay‑specific log file noted in the Phase 3/4 documentation.
2. Locate an entry whose:
   - `sessionId` matches the one used in the test,
   - `seq` matches the replayed message’s sequence number,
   - `eventType` is `REPLAY_ATTEMPT` (or equivalent),
   - `reason` is “Sequence number not monotonic”, “Timestamp out of validity window”, or another replay‑related cause,
   - `action` is `"REJECTED"`.
3. Confirm, via the database (if accessible and safe for your environment), that:
   - There is a single `messages_meta` record for the original `messageId = sessionId:seq:timestamp`.
   - No second record was created when the replay was attempted.

#### Step 6: Use the Replay Simulator API (If Available)

If your test harness or UI exposes the documented replay simulator:

1. Capture a message using the simulator:
   - `captureMessage(sessionId, envelope)`
2. Run the timestamp/sequence‑aware replay:
   - `simulateReplayWithTimestampCheck(sessionId, envelope, lastSeq)`
3. Confirm that the simulator reports the replay as **rejected** and that internally it exercised the same timestamp and sequence checks described above.
4. Export the replay attack log using:
   - `getReplayAttackLog()` or `exportReplayAttackLog(...)`, as documented.
5. Store this exported log together with:
   - The original and replayed envelopes (captured from network),
   - Relevant entries from `replay_attempts.log`,
   - Screenshots of Bob’s UI showing that no duplicate message appears.

### Evidence Requirements

To document replay resistance in a report, include:

- **Network evidence**:
  - A captured frame (or HAR/pcap snippet) showing the original encrypted envelope.
  - A second captured frame showing the replayed envelope with identical `sessionId`, `seq`, and `timestamp`.
- **Server log evidence**:
  - Extracts from `server/logs/replay_attempts.log` (and any replay‑detected log) showing:
    - The event type (`REPLAY_ATTEMPT` or similar),
    - Session and sequence information,
    - A clear rejection reason and `"REJECTED"` action.
- **Client/UI evidence**:
  - Screenshot(s) of Bob’s chat UI showing the original message appears exactly once.
  - Optional console snapshots (if enabled) showing that a replayed envelope was discarded.
- **Simulator evidence (if used)**:
  - Exported replay attack logs from the simulator indicating that replay attempts fail because of timestamp and sequence validation.

---

## MITM Attack Defense

### Explanation

The system’s key exchange protocol is built on Elliptic Curve Diffie–Hellman (ECDH) using ephemeral keys, but it adds digital signatures and key confirmation to protect against man‑in‑the‑middle (MITM) attacks. In a pure, unsigned DH/ECDH exchange, an attacker positioned on the network path can intercept and replace each party’s public key, establishing separate shared secrets with both victims while remaining invisible to them. This project explicitly documents an **“unsigned ECDH”** simulation mode where such an attack succeeds, contrasted with the **production “signed ECDH”** mode in which ephemeral keys are authenticated with long‑term identity keys (ECDSA P‑256) and a key‑confirmation HMAC.

In the secured protocol:

- Each user possesses a long‑lived identity key pair (`IK_priv`, `IK_pub`). Identity private keys remain encrypted in the client’s IndexedDB and never leave the device.
- For each session, each side generates a fresh ECDH P‑256 ephemeral key pair (`EK_priv`, `EK_pub`) and signs the ephemeral public key with their identity private key.
- The Key Exchange Protocol (KEP) messages (KEP_INIT and KEP_RESPONSE) carry both the ephemeral public key and its signature; peers verify signatures with `IK_pub` fetched from the server’s public key directory.
- After ECDH and HKDF, a `rootKey` is derived, and a key‑confirmation HMAC (e.g., `HMAC‑SHA256(rootKey, "CONFIRM:" + peerUserId)`) is used to ensure both parties derived the same root key, closing remaining MITM avenues.
- Invalid signatures or key‑confirmation mismatches cause the session to be rejected and generate entries in `invalid_signature.log` and related security logs.

### Technical Breakdown

#### Identity Keys and Ephemeral Keys

- **Identity keys**:
  - Algorithm: ECDSA P‑256.
  - Purpose: Represent the long‑term cryptographic identity of each user.
  - Storage:
    - `IK_priv`: Encrypted with password‑derived AES‑GCM and stored in the client’s IndexedDB.
    - `IK_pub`: Stored on the server in a public key directory, retrievable by `GET /api/keys/:userId`.
- **Ephemeral keys**:
  - Algorithm: ECDH P‑256.
  - Generated per session on each client (`EK_priv_A`/`EK_pub_A` for Alice; `EK_priv_B`/`EK_pub_B` for Bob).
  - Stored in memory only; discarded after session establishment to provide forward secrecy.

#### Signing Ephemeral Keys

- On session initiation:
  - Alice generates `EK_priv_A`/`EK_pub_A` and exports `EK_pub_A` as JWK.
  - She computes a payload `JSON.stringify(EK_pub_A_JWK)`, encodes it, and signs it with `IK_priv_A` using ECDSA‑SHA256.
  - The resulting base64 signature is included in `KEP_INIT` together with:
    - `type`, `from`, `to`, `sessionId`,
    - `ephPub` (the JWK representation),
    - `signature`,
    - `timestamp`, `seq`, `nonce`.
- Bob follows the same pattern when sending `KEP_RESPONSE`:
  - Generates `EK_priv_B`/`EK_pub_B`, signs `EK_pub_B` with `IK_priv_B`, and includes the signature plus a key‑confirmation HMAC.

#### Signature Verification and MITM Prevention

- On receipt of `KEP_INIT` or `KEP_RESPONSE`, the peer:
  - Fetches the sender’s `IK_pub` from the server’s key directory (if not cached).
  - Reconstructs the signed payload from the `ephPub` JWK.
  - Uses Web Crypto API or Node crypto (depending on context) to verify the ECDSA‑SHA256 signature.
  - Verifies timestamp freshness (±2 minutes) and performs replay checks (timestamp, sequence, message ID).
- If signature verification fails:
  - The message is **rejected**.
  - A log entry is written to `invalid_signature.log` indicating a signature failure on a KEP message.
- Because the attacker does not have access to `IK_priv`:
  - Any attempt to replace `EK_pub` with an attacker‑controlled value produces an invalid signature.
  - The receiving client detects the tampering before any ECDH or HKDF steps, preventing the attacker from establishing split sessions.

#### Shared Secret, HKDF, and Key Confirmation

- After successful signature and replay checks:
  - Each side imports the peer’s ephemeral public key and performs ECDH:
    - Alice: `sharedSecret = ECDH(EK_priv_A, EK_pub_B)`.
    - Bob: `sharedSecret = ECDH(EK_priv_B, EK_pub_A)`.
  - They derive:
    - `rootKey = HKDF(sharedSecret, salt="ROOT", info=sessionId, length=256 bits)`.
    - `sendKey = HKDF(rootKey, salt="SEND", info=userId, length=256 bits)`.
    - `recvKey = HKDF(rootKey, salt="RECV", info=peerId, length=256 bits)`.
- Key confirmation:
  - The responder computes `keyConfirmation = HMAC‑SHA256(rootKey, "CONFIRM:" + initiatorUserId)` and includes it in `KEP_RESPONSE`.
  - The initiator recomputes the same HMAC from its own `rootKey` and compares it with the received value.
  - If the values differ, the session is rejected and keys are discarded, signalling either an implementation bug or an active attack.

#### Unsigned vs Signed Modes

- **Unsigned ECDH (attack demo mode)**:
  - Ephemeral public keys are exchanged without signatures.
  - The MITM simulator’s `simulateMITMOnUnsignedECDH` function demonstrates that an attacker who intercepts and replaces keys can successfully derive shared secrets with both victims, illustrating classic DH MITM vulnerability.
- **Signed ECDH (production protocol)**:
  - Ephemeral keys are always signed with identity keys, signatures are verified by peers, and key confirmation is performed.
  - The MITM simulator’s `simulateMITMOnSignedECDH` function demonstrates that attacks are blocked:
    - Substituted keys produce invalid signatures and are rejected.
    - Even if keys were somehow altered later, mismatched key‑confirmation HMACs would prevent session establishment.

### Demonstration Instructions

The following steps show how to demonstrate the difference between the vulnerable unsigned variant and the secure signed protocol using the documented attack simulator and logs.

#### Step 1: Environment Setup

1. Ensure the backend and frontend are running locally as described in the Deployment and Demo Script documentation:
   - `cd server && npm install && npm run dev`
   - `cd client && npm install && npm run dev`
2. Open `https://localhost:5173` and accept the self‑signed certificate.
3. Register and log in the test users (e.g., Alice and Bob) and ensure that normal sessions can be established in the chat UI.

#### Step 2: Unsecured Protocol Variant (Unsigned ECDH)

1. Open the **attack simulator UI** as referenced in the demo script.
2. Select the **“unsigned ECDH”** mode, which uses `simulateMITMOnUnsignedECDH`.
3. Run the MITM simulation for a test session between Alice and Bob.
4. Observe:
   - The simulator reports that the attack **succeeds** in this mode.
   - Any available internal logs from the simulator indicate that the attacker is able to derive the same or equivalent session secrets as each victim.
5. Optionally, capture WebSocket or HTTP traffic:
   - Use browser DevTools Network tab (WebSocket frames) or Wireshark/Burp on the documented WSS endpoint.
   - Confirm that no signature fields are present in the unsigned variant’s key exchange messages and that no signature verification failures are logged (because none are attempted).

#### Step 3: Secure Protocol Variant (Signed ECDH)

1. In the same attack simulator, switch to the **“signed ECDH”** mode, which uses `simulateMITMOnSignedECDH`.
2. Run the MITM simulation again for a test session between Alice and Bob.
3. Observe:
   - The simulator reports that the attack is **blocked**.
   - The simulated attacker fails to obtain valid shared secrets that match those derived by the honest parties.
4. Inspect server logs:
   - Open `server/logs/invalid_signature.log`.
   - Locate entries corresponding to the attempted MITM, indicating:
     - Signature verification failures on KEP messages.
     - Rejection of those messages as part of the key exchange.
5. Verify that in this scenario, Alice and Bob do **not** successfully establish a session using attacker‑substituted keys:
   - Either the session fails outright or a new, honest session must be established without MITM interference.

#### Step 4: Correlate with Packet Captures (Optional but Recommended)

1. Capture KEP_INIT and KEP_RESPONSE traffic during a **normal, non‑attacked** run:
   - Confirm presence of `ephPub`, `signature`, `timestamp`, `seq`, `nonce`, and (for KEP_RESPONSE) `keyConfirmation`.
2. Capture traffic during the **signed ECDH MITM attempt**:
   - Confirm that when an attacker modifies `ephPub`, the signatures no longer match the JWK payload.
   - Correlate the tampered messages with entries in `invalid_signature.log`.
3. Use these captures to visually demonstrate:
   - The difference between unsigned and signed ECDH flows.
   - How signature fields and key confirmation enforce MITM resistance.

### Evidence Requirements

To demonstrate MITM defense in a report, include:

- **Simulator evidence**:
  - Screenshots or log exports from:
    - `simulateMITMOnUnsignedECDH` showing successful MITM in the unsigned variant.
    - `simulateMITMOnSignedECDH` showing that the attack is blocked in the signed protocol.
  - Optionally, exported attack logs via `getAttackLog` / `exportAttackLog`.
- **Server log evidence**:
  - Extracts from `server/logs/invalid_signature.log` demonstrating:
    - Signature verification failures on tampered KEP messages.
    - Corresponding rejection actions.
  - Any entries from other key exchange or security logs that show invalid messages or attacks being detected.
- **Network/packet evidence**:
  - Captured KEP_INIT/KEP_RESPONSE messages for:
    - The unsigned variant (no signatures) to illustrate the vulnerability.
    - The signed variant (with signatures and key confirmation) to illustrate how tampering leads to invalid signatures.
  - Annotated traces showing that in the signed mode, modified ephemeral keys are rejected.
- **Protocol interpretation**:
  - A short narrative explaining:
    - How unsigned ECDH allows MITM by key substitution.
    - How signed ECDH with identity keys and key‑confirmation HMACs binds ephemeral keys to user identities and prevents an attacker from forging or replaying them.

---

## Missing Details

The following items remain either partially or fully undocumented at the **user‑visible** level and should be treated as documentation gaps, even though some underlying implementation details are known from the codebase:

- **Nonce validation**:
  - Nonces are generated with `generateNonce(16)` (16 random bytes) and included in both KEP messages and encrypted envelopes as base64‑encoded values via `generateTimestamp()`.
  - There is **no implemented client‑side or server‑side nonce uniqueness check** in the current system; nonce‑based replay detection (e.g., Bloom‑filter tracking) is still only a planned enhancement.
- **Session ID generation and validation**:
  - `sessionId` is supplied by the client (e.g., when creating sessions) and is used in HKDF (`info`) and as part of `messageId = sessionId:seq:timestamp`, and it is the primary key for the `sessions` object store.
  - There is no documented, canonical algorithm for generating `sessionId` (format, entropy), and no separate server‑side validation is described beyond its indirect use inside `messageId`.
- **Sequence number lifecycle across advanced scenarios**:
  - Per‑session, strictly monotonic `seq` handling is implemented (via the `SequenceManager` in `messages.js` and `lastSeq` in `sessionManager.js`), and tests exercise this behavior.
  - It remains undocumented how sequence numbers should behave across key‑rotation workflows or concurrent multi‑sender scenarios within the same session (if such scenarios are ever exposed to users).
- **Key confirmation failure handling (UI/UX)**:
  - At the protocol level, `validateKEPResponse` returns `{ valid: false, error: 'Key confirmation failed' }` and the session is rejected; corresponding security logs may be written.
  - The documentation does **not** specify:
    - Whether a new key exchange is automatically initiated after such a failure.
    - How, if at all, the user interface surfaces this error or instructs the user to retry.
    - Any rate‑limiting or retry policies for repeated key‑confirmation failures.
