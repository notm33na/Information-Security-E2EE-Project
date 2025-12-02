# Replay Protection Testcase Suite

## TC-ID: REPLAY-001

**Title:** Timestamp Window Enforcement - Stale Message Rejection
**Objective:** Verify messages older than 2 minutes are rejected
**Prerequisites:**

- Established session
- Message envelope with timestamp = 3 minutes ago
- Browser console access

**Detailed Steps:**

1. Create message envelope with `timestamp = Date.now() - 180000` (3 minutes ago)
2. Bob receives envelope
3. Monitor `validateTimestamp()` function execution
4. Verify timestamp validation:
   - `age = Date.now() - envelope.timestamp`
   - `age = 180000` (3 minutes)
   - `age > 120000` (2 minutes) → REJECT
5. Verify rejection:
   - Message rejected: "Timestamp out of validity window"
   - Error logged
   - Message not decrypted
   - No plaintext returned

**Expected Outcome:**

- Stale message rejected
- Timestamp validation fails
- Error logged appropriately
- Message not processed

**Evidence to Capture:**

- Timestamp validation result
- Rejection reason
- Log entry
- Message processing status

**Pass/Fail Criteria:**

- PASS: Stale message rejected, logged, not processed
- FAIL: Stale message accepted or not logged

**PDF Requirements Validated:**

- Timestamp window enforcement
- ±2 minute window

---

## TC-ID: REPLAY-002

**Title:** Timestamp Window Enforcement - Future Message Rejection
**Objective:** Verify messages from future (>2 minutes) are rejected
**Prerequisites:**

- Established session
- Message envelope with timestamp = 3 minutes in future
- Browser console access

**Detailed Steps:**

1. Create message envelope with `timestamp = Date.now() + 180000` (3 minutes in future)
2. Bob receives envelope
3. Monitor `validateTimestamp()` function execution
4. Verify timestamp validation:
   - `age = Date.now() - envelope.timestamp`
   - `age = -180000` (negative, future)
   - `Math.abs(age) > 120000` → REJECT
5. Verify rejection:
   - Message rejected: "Timestamp out of validity window"
   - Error logged
   - Message not decrypted
   - No plaintext returned

**Expected Outcome:**

- Future message rejected
- Timestamp validation fails
- Error logged appropriately
- Message not processed

**Evidence to Capture:**

- Timestamp validation result
- Rejection reason
- Log entry
- Message processing status

**Pass/Fail Criteria:**

- PASS: Future message rejected, logged, not processed
- FAIL: Future message accepted or not logged

**PDF Requirements Validated:**

- Timestamp window enforcement
- Clock skew protection

---

## TC-ID: REPLAY-003

**Title:** Timestamp Window Enforcement - Valid Timestamp Acceptance
**Objective:** Verify messages within ±2 minute window are accepted
**Prerequisites:**

- Established session
- Message envelope with valid timestamp
- Browser console access

**Detailed Steps:**

1. Create message envelope with `timestamp = Date.now() - 60000` (1 minute ago, within window)
2. Bob receives envelope
3. Monitor `validateTimestamp()` function execution
4. Verify timestamp validation:
   - `age = Date.now() - envelope.timestamp`
   - `age = 60000` (1 minute)
   - `Math.abs(age) <= 120000` → ACCEPT
5. Verify acceptance:
   - Timestamp validation passes
   - Message proceeds to next validation layer
   - Message can be decrypted (if other checks pass)

**Expected Outcome:**

- Valid timestamp accepted
- Timestamp validation passes
- Message proceeds to decryption

**Evidence to Capture:**

- Timestamp validation result
- Message processing continuation
- Decryption success (if applicable)

**Pass/Fail Criteria:**

- PASS: Valid timestamp accepted, message processed
- FAIL: Valid timestamp rejected

**PDF Requirements Validated:**

- Timestamp window enforcement
- Valid message acceptance

---

## TC-ID: REPLAY-004

**Title:** Strict Sequence Number Enforcement - Duplicate Sequence Rejection
**Objective:** Verify messages with duplicate sequence numbers are rejected
**Prerequisites:**

- Established session
- Message with seq=5 already processed (lastSeq=5)
- Duplicate message with seq=5

**Detailed Steps:**

1. Bob receives and processes message with seq=5
2. `lastSeq` updated to 5 in IndexedDB
3. Attacker replays same message with seq=5
4. Bob receives replayed envelope
5. Monitor `validateSequence()` function execution
6. Verify sequence validation:
   - `lastSeq = 5` (from IndexedDB)
   - `envelope.seq = 5`
   - `envelope.seq <= lastSeq` → REJECT
7. Verify rejection:
   - Message rejected: "Sequence number must be strictly increasing"
   - Error logged
   - Message not decrypted
   - `lastSeq` remains 5 (not updated)

**Expected Outcome:**

- Duplicate sequence rejected
- Sequence validation fails
- Error logged appropriately
- lastSeq not updated

**Evidence to Capture:**

- Sequence validation result
- Rejection reason
- Log entry
- lastSeq value (unchanged)

**Pass/Fail Criteria:**

- PASS: Duplicate sequence rejected, logged, lastSeq unchanged
- FAIL: Duplicate sequence accepted or lastSeq updated

**PDF Requirements Validated:**

- Strict sequence number enforcement
- Monotonic sequence requirement

---

## TC-ID: REPLAY-005

**Title:** Strict Sequence Number Enforcement - Decreasing Sequence Rejection
**Objective:** Verify messages with decreasing sequence numbers are rejected
**Prerequisites:**

- Established session
- Message with seq=10 already processed (lastSeq=10)
- Message with seq=8 (decreasing)

**Detailed Steps:**

1. Bob receives and processes message with seq=10
2. `lastSeq` updated to 10 in IndexedDB
3. Attacker sends message with seq=8 (decreasing)
4. Bob receives envelope
5. Monitor `validateSequence()` function execution
6. Verify sequence validation:
   - `lastSeq = 10` (from IndexedDB)
   - `envelope.seq = 8`
   - `envelope.seq <= lastSeq` → REJECT
7. Verify rejection:
   - Message rejected: "Sequence number must be strictly increasing"
   - Error logged
   - Message not decrypted
   - `lastSeq` remains 10 (not updated)

**Expected Outcome:**

- Decreasing sequence rejected
- Sequence validation fails
- Error logged appropriately
- lastSeq not updated

**Evidence to Capture:**

- Sequence validation result
- Rejection reason
- Log entry
- lastSeq value (unchanged)

**Pass/Fail Criteria:**

- PASS: Decreasing sequence rejected, logged, lastSeq unchanged
- FAIL: Decreasing sequence accepted or lastSeq updated

**PDF Requirements Validated:**

- Strict sequence number enforcement
- Monotonic sequence requirement

---

## TC-ID: REPLAY-006

**Title:** Strict Sequence Number Enforcement - Valid Sequence Acceptance
**Objective:** Verify messages with increasing sequence numbers are accepted
**Prerequisites:**

- Established session
- Message with seq=5 already processed (lastSeq=5)
- Message with seq=6 (increasing)

**Detailed Steps:**

1. Bob receives and processes message with seq=5
2. `lastSeq` updated to 5 in IndexedDB
3. Bob receives message with seq=6
4. Monitor `validateSequence()` function execution
5. Verify sequence validation:
   - `lastSeq = 5` (from IndexedDB)
   - `envelope.seq = 6`
   - `envelope.seq > lastSeq` → ACCEPT
6. Verify acceptance:
   - Sequence validation passes
   - Message proceeds to decryption
   - After successful decryption, `lastSeq` updated to 6

**Expected Outcome:**

- Valid sequence accepted
- Sequence validation passes
- Message decrypted
- lastSeq updated

**Evidence to Capture:**

- Sequence validation result
- Message decryption success
- lastSeq update (5 → 6)

**Pass/Fail Criteria:**

- PASS: Valid sequence accepted, message processed, lastSeq updated
- FAIL: Valid sequence rejected or lastSeq not updated

**PDF Requirements Validated:**

- Strict sequence number enforcement
- Valid sequence acceptance

---

## TC-ID: REPLAY-007

**Title:** MessageId Uniqueness Enforcement - Duplicate MessageId Rejection
**Objective:** Verify duplicate messageId is rejected at server
**Prerequisites:**

- Test user sending message
- Access to MongoDB database
- Message already stored with messageId

**Detailed Steps:**

1. Alice sends message
2. Server generates `messageId = sessionId:seq:timestamp`
3. Server stores MessageMeta document with messageId
4. Attacker replays same message (same sessionId, seq, timestamp)
5. Server receives replayed envelope
6. Monitor `generateMessageId()` and database check
7. Verify messageId generation:
   - `messageId = sessionId:seq:timestamp` (same as original)
8. Verify uniqueness check:
   - MongoDB query: `MessageMeta.findOne({ messageId })`
   - Existing document found → REJECT
9. Verify rejection:
   - Duplicate key error (E11000) or application-level check
   - Error logged: "Duplicate messageId detected"
   - Message not stored
   - Message not forwarded

**Expected Outcome:**

- Duplicate messageId rejected
- Database uniqueness constraint enforced
- Error logged appropriately
- Message not stored or forwarded

**Evidence to Capture:**

- MessageId generation
- Database uniqueness check
- Rejection reason
- Log entry

**Pass/Fail Criteria:**

- PASS: Duplicate messageId rejected, logged, not stored
- FAIL: Duplicate messageId accepted or not logged

**PDF Requirements Validated:**

- MessageId uniqueness enforcement
- Database uniqueness constraint

---

## TC-ID: REPLAY-008

**Title:** MessageId Uniqueness Enforcement - Compound Index Validation
**Objective:** Verify compound index (sessionId, seq, timestamp) enforces uniqueness
**Prerequisites:**

- Test user sending message
- Access to MongoDB database
- Message already stored

**Detailed Steps:**

1. Alice sends message with sessionId="sess1", seq=5, timestamp=1000
2. Server stores MessageMeta document
3. Verify compound index exists:
   - `{ sessionId: 1, seq: 1, timestamp: 1 }` unique index
4. Attacker replays message with same (sessionId, seq, timestamp)
5. Server attempts to store duplicate
6. Verify compound index enforcement:
   - MongoDB unique index prevents duplicate
   - Or application-level pre-save hook detects duplicate
7. Verify rejection:
   - Error: "Duplicate message triple detected"
   - Message not stored
   - Error logged

**Expected Outcome:**

- Compound index enforces uniqueness
- Duplicate triple rejected
- Error logged appropriately

**Evidence to Capture:**

- Compound index verification
- Duplicate triple rejection
- Error log

**Pass/Fail Criteria:**

- PASS: Compound index enforces uniqueness, duplicate rejected
- FAIL: Duplicate triple accepted or index not enforced

**PDF Requirements Validated:**

- MessageId uniqueness enforcement
- Compound index uniqueness

---

## TC-ID: REPLAY-009

**Title:** Nonce Replay Rejection - Duplicate Nonce Detection (Client-Side)
**Objective:** Verify duplicate nonce is rejected on client-side
**Prerequisites:**

- Established session
- Message with nonce already processed
- Duplicate message with same nonce

**Detailed Steps:**

1. Bob receives message with nonce
2. Nonce hash computed: `SHA-256(nonceBytes)` → hex string
3. Nonce hash stored in IndexedDB session metadata
4. Attacker replays same message with same nonce
5. Bob receives replayed envelope
6. Monitor `isNonceUsed()` function execution
7. Verify nonce validation:
   - Nonce decoded from base64
   - Nonce hash computed: `SHA-256(nonceBytes)`
   - `isNonceUsed(sessionId, nonceHash)` → true
8. Verify rejection:
   - Message rejected: "Duplicate nonce for this session"
   - Error logged
   - Message not decrypted
   - Nonce hash already in usedNonces array

**Expected Outcome:**

- Duplicate nonce rejected
- Nonce uniqueness enforced
- Error logged appropriately
- Message not processed

**Evidence to Capture:**

- Nonce hash computation
- Nonce uniqueness check
- Rejection reason
- Log entry

**Pass/Fail Criteria:**

- PASS: Duplicate nonce rejected, logged, not processed
- FAIL: Duplicate nonce accepted or not logged

**PDF Requirements Validated:**

- Nonce replay rejection
- Client-side nonce validation

---

## TC-ID: REPLAY-010

**Title:** Nonce Replay Rejection - Duplicate Nonce Detection (Server-Side)
**Objective:** Verify duplicate nonce is rejected on server-side
**Prerequisites:**

- Test user sending message
- Access to MongoDB database
- Message with nonce already stored

**Detailed Steps:**

1. Alice sends message with nonce
2. Server hashes nonce: `hashNonceBase64(nonce)` → hex string
3. Server stores MessageMeta with nonceHash
4. Attacker replays same message with same nonce
5. Server receives replayed envelope
6. Monitor `isNonceHashUsed()` function execution
7. Verify nonce validation:
   - Nonce hash computed: `SHA-256(nonceBytes)` → hex string
   - MongoDB query: `MessageMeta.findOne({ sessionId, nonceHash })`
   - Existing document found → REJECT
8. Verify rejection:
   - Message rejected: "REPLAY_REJECT: Duplicate nonce detected in session"
   - Error logged
   - Message not stored
   - Message not forwarded

**Expected Outcome:**

- Duplicate nonce rejected at server
- Nonce uniqueness enforced
- Error logged appropriately
- Message not stored or forwarded

**Evidence to Capture:**

- Nonce hash computation
- Database nonce check
- Rejection reason
- Log entry

**Pass/Fail Criteria:**

- PASS: Duplicate nonce rejected, logged, not stored
- FAIL: Duplicate nonce accepted or not logged

**PDF Requirements Validated:**

- Nonce replay rejection
- Server-side nonce validation

---

## TC-ID: REPLAY-011

**Title:** Client-Side Replay Rejection - Multi-Layer Protection
**Objective:** Verify client-side rejects replays through multiple validation layers
**Prerequisites:**

- Established session
- Replayed message envelope
- Browser console access

**Detailed Steps:**

1. Bob receives replayed message envelope
2. Monitor `handleIncomingMessage()` execution
3. Verify Layer 1: Structure Validation
   - `validateEnvelopeStructure()` called
   - If structure invalid → REJECT (early exit)
4. Verify Layer 2: Timestamp Validation
   - `validateTimestamp()` called
   - If timestamp stale/future → REJECT, log, return
5. Verify Layer 3: Sequence Validation
   - `sequenceManager.validateSequence()` called
   - If seq <= lastSeq → REJECT, log, return
6. Verify Layer 4: Nonce Validation
   - `isNonceUsed()` called
   - If nonce duplicate → REJECT, log, return
7. Verify Layer 5: Decryption (if all pass)
   - Only if all layers pass → decrypt
   - AuthTag verification during decryption

**Expected Outcome:**

- Multiple validation layers executed
- Replay rejected at appropriate layer
- Error logged at rejection layer
- Message not decrypted if any layer fails

**Evidence to Capture:**

- Validation layer execution order
- Rejection layer identification
- Log entries from each layer
- Decryption status

**Pass/Fail Criteria:**

- PASS: Multi-layer protection works, replay rejected, logged
- FAIL: Replay accepted or layers not executed

**PDF Requirements Validated:**

- Client-side replay rejection
- Multi-layer protection

---

## TC-ID: REPLAY-012

**Title:** Server-Side Replay Rejection - Multi-Layer Protection
**Objective:** Verify server-side rejects replays through multiple validation layers
**Prerequisites:**

- Test user sending message
- Access to server logs
- Replayed message envelope

**Detailed Steps:**

1. Attacker sends replayed message envelope to server
2. Monitor `msg:send` handler execution
3. Verify Layer 1: Timestamp Validation
   - `validateTimestamp()` called
   - If timestamp stale/future → REJECT, log, return
4. Verify Layer 2: Nonce Validation
   - `hashNonceBase64()` called
   - `isNonceHashUsed()` called
   - If nonce duplicate → REJECT, log, return
5. Verify Layer 3: MessageId Uniqueness
   - `generateMessageId()` called
   - Database uniqueness check
   - If messageId duplicate → REJECT, log, return
6. Verify Layer 4: Metadata Storage (if all pass)
   - Only if all layers pass → store metadata
   - Forward envelope to receiver

**Expected Outcome:**

- Multiple validation layers executed
- Replay rejected at appropriate layer
- Error logged at rejection layer
- Message not stored or forwarded if any layer fails

**Evidence to Capture:**

- Validation layer execution order
- Rejection layer identification
- Log entries from each layer
- Metadata storage status

**Pass/Fail Criteria:**

- PASS: Multi-layer protection works, replay rejected, logged
- FAIL: Replay accepted or layers not executed

**PDF Requirements Validated:**

- Server-side replay rejection
- Multi-layer protection

---

## TC-ID: REPLAY-013

**Title:** Multi-Layer Replay Rejection - Client and Server Coordination
**Objective:** Verify replay is rejected at both client and server layers
**Prerequisites:**

- Established session
- Replayed message envelope
- Access to both client and server logs

**Detailed Steps:**

1. Attacker replays message
2. Server receives envelope first
3. Verify server-side rejection:
   - Server validates timestamp, nonce, messageId
   - If any check fails → REJECT, log
   - Message not stored or forwarded
4. If server forwards (shouldn't happen), verify client-side rejection:
   - Client receives envelope
   - Client validates timestamp, sequence, nonce
   - If any check fails → REJECT, log
   - Message not decrypted
5. Verify coordination:
   - Server logs show rejection
   - Client logs show rejection (if envelope forwarded)
   - No duplicate processing

**Expected Outcome:**

- Replay rejected at server (primary)
- Replay rejected at client (if forwarded)
- Both layers log rejection
- No duplicate message processing

**Evidence to Capture:**

- Server log entries
- Client log entries
- Rejection at both layers
- No duplicate processing

**Pass/Fail Criteria:**

- PASS: Replay rejected at both layers, logged, no duplicate
- FAIL: Replay accepted at either layer or not logged

**PDF Requirements Validated:**

- Multi-layer replay rejection
- Client and server coordination

---

## TC-ID: REPLAY-014

**Title:** Replay Using WebSocket Inspector - Captured Message Replay
**Objective:** Verify replay attempt using WebSocket inspector is rejected
**Prerequisites:**

- Established session
- WebSocket inspector tool (browser DevTools)
- Message sent and captured

**Detailed Steps:**

1. Alice sends message to Bob
2. Capture message in WebSocket inspector:
   - Open DevTools → Network → WebSocket
   - Locate `msg:send` frame
   - Copy envelope JSON
3. Wait for original message to be processed
4. Replay captured envelope:
   - Use WebSocket inspector or script
   - Send same envelope via `msg:send` event
5. Verify rejection:
   - Server receives replayed envelope
   - Timestamp/sequence/nonce/messageId validation fails
   - Message rejected
   - Error logged
6. Verify no duplicate:
   - Bob's UI shows message only once
   - No duplicate in chat history

**Expected Outcome:**

- Captured message replay rejected
- Validation fails (timestamp/sequence/nonce/messageId)
- Error logged
- No duplicate message in UI

**Evidence to Capture:**

- Captured envelope
- Replay attempt
- Rejection reason
- Log entry
- UI screenshot (no duplicate)

**Pass/Fail Criteria:**

- PASS: Replay rejected, logged, no duplicate in UI
- FAIL: Replay accepted or duplicate appears

**PDF Requirements Validated:**

- Replay using WebSocket inspector
- Captured message replay rejection

---

## TC-ID: REPLAY-015

**Title:** Replay Using Script - Automated Replay Attack
**Objective:** Verify automated replay attack using script is rejected
**Prerequisites:**

- Established session
- Replay script capability
- Message sent and captured

**Detailed Steps:**

1. Alice sends message to Bob
2. Capture message envelope (JSON)
3. Create replay script:
   - Connect to WebSocket
   - Authenticate
   - Send captured envelope via `msg:send`
4. Execute script multiple times:
   - Attempt replay 1: Same envelope
   - Attempt replay 2: Same envelope
   - Attempt replay 3: Same envelope
5. Verify rejection for each attempt:
   - Server rejects each replay
   - Error logged for each attempt
   - Message not stored or forwarded
6. Verify no duplicate:
   - Bob's UI shows message only once
   - Server logs show multiple rejection entries

**Expected Outcome:**

- Automated replay rejected
- Each attempt logged separately
- No duplicate message in UI
- Multiple rejection entries in logs

**Evidence to Capture:**

- Replay script
- Replay attempts
- Rejection logs (multiple entries)
- UI screenshot (no duplicate)

**Pass/Fail Criteria:**

- PASS: All replays rejected, logged, no duplicate
- FAIL: Any replay accepted or not logged

**PDF Requirements Validated:**

- Replay using script
- Automated replay rejection

---

## TC-ID: REPLAY-016

**Title:** Replay During KEP - KEP_INIT Replay
**Objective:** Verify KEP_INIT message replay is rejected
**Prerequisites:**

- Two authenticated users
- KEP_INIT message sent and processed
- Replayed KEP_INIT

**Detailed Steps:**

1. Alice sends KEP_INIT to Bob
2. Bob processes KEP_INIT, session established
3. Attacker replays same KEP_INIT
4. Bob receives replayed KEP_INIT
5. Verify replay detection:
   - Timestamp validation (if stale) → REJECT
   - Sequence validation: seq=1 already processed → REJECT
   - MessageId uniqueness (server-side) → REJECT
6. Verify rejection:
   - KEP_INIT rejected
   - Error logged
   - No new session established
   - Existing session not affected

**Expected Outcome:**

- KEP_INIT replay rejected
- Timestamp/sequence/messageId validation fails
- Error logged
- No duplicate session

**Evidence to Capture:**

- KEP_INIT replay attempt
- Rejection reason
- Log entry
- Session status (no duplicate)

**Pass/Fail Criteria:**

- PASS: KEP_INIT replay rejected, logged, no duplicate session
- FAIL: KEP_INIT replay accepted or not logged

**PDF Requirements Validated:**

- Replay during KEP
- KEP_INIT replay rejection

---

## TC-ID: REPLAY-017

**Title:** Replay During KEP - KEP_RESPONSE Replay
**Objective:** Verify KEP_RESPONSE message replay is rejected
**Prerequisites:**

- Two authenticated users
- KEP_RESPONSE message sent and processed
- Replayed KEP_RESPONSE

**Detailed Steps:**

1. Bob sends KEP_RESPONSE to Alice
2. Alice processes KEP_RESPONSE, session established
3. Attacker replays same KEP_RESPONSE
4. Alice receives replayed KEP_RESPONSE
5. Verify replay detection:
   - Timestamp validation (if stale) → REJECT
   - Sequence validation: seq=2 already processed → REJECT
   - MessageId uniqueness (server-side) → REJECT
6. Verify rejection:
   - KEP_RESPONSE rejected
   - Error logged
   - No new session established
   - Existing session not affected

**Expected Outcome:**

- KEP_RESPONSE replay rejected
- Timestamp/sequence/messageId validation fails
- Error logged
- No duplicate session

**Evidence to Capture:**

- KEP_RESPONSE replay attempt
- Rejection reason
- Log entry
- Session status (no duplicate)

**Pass/Fail Criteria:**

- PASS: KEP_RESPONSE replay rejected, logged, no duplicate session
- FAIL: KEP_RESPONSE replay accepted or not logged

**PDF Requirements Validated:**

- Replay during KEP
- KEP_RESPONSE replay rejection

---

## TC-ID: REPLAY-018

**Title:** Replay During Messaging - Text Message Replay
**Objective:** Verify text message replay is rejected
**Prerequisites:**

- Established session
- Text message sent and processed
- Replayed text message

**Detailed Steps:**

1. Alice sends text message "Hello" to Bob
2. Bob receives and processes message (seq=5)
3. Attacker replays same message (seq=5)
4. Bob receives replayed message
5. Verify replay detection:
   - Timestamp validation (if stale) → REJECT
   - Sequence validation: seq=5 <= lastSeq=5 → REJECT
   - Nonce validation: duplicate nonce → REJECT
   - MessageId uniqueness (server-side) → REJECT
6. Verify rejection:
   - Message rejected
   - Error logged
   - No duplicate message in UI
   - lastSeq remains 5

**Expected Outcome:**

- Text message replay rejected
- Multiple validation layers fail
- Error logged
- No duplicate message in UI

**Evidence to Capture:**

- Text message replay attempt
- Rejection reason
- Log entry
- UI screenshot (no duplicate)

**Pass/Fail Criteria:**

- PASS: Text message replay rejected, logged, no duplicate
- FAIL: Text message replay accepted or not logged

**PDF Requirements Validated:**

- Replay during messaging
- Text message replay rejection

---

## TC-ID: REPLAY-019

**Title:** Replay on File Chunks - FILE_CHUNK Replay
**Objective:** Verify FILE_CHUNK replay is rejected
**Prerequisites:**

- Established session
- FILE_CHUNK sent and processed
- Replayed FILE_CHUNK

**Detailed Steps:**

1. Alice sends FILE_CHUNK (chunkIndex=0) to Bob
2. Bob receives and processes chunk (seq=10)
3. Attacker replays same FILE_CHUNK (seq=10, chunkIndex=0)
4. Bob receives replayed chunk
5. Verify replay detection:
   - Timestamp validation (if stale) → REJECT
   - Sequence validation: seq=10 <= lastSeq=10 → REJECT
   - Nonce validation: duplicate nonce → REJECT
   - MessageId uniqueness (server-side) → REJECT
6. Verify rejection:
   - FILE_CHUNK rejected
   - Error logged
   - Chunk not added to file reconstruction
   - File reconstruction not affected

**Expected Outcome:**

- FILE_CHUNK replay rejected
- Multiple validation layers fail
- Error logged
- File reconstruction not affected

**Evidence to Capture:**

- FILE_CHUNK replay attempt
- Rejection reason
- Log entry
- File reconstruction status

**Pass/Fail Criteria:**

- PASS: FILE_CHUNK replay rejected, logged, file not affected
- FAIL: FILE_CHUNK replay accepted or not logged

**PDF Requirements Validated:**

- Replay on file chunks
- FILE_CHUNK replay rejection

---

## TC-ID: REPLAY-020

**Title:** Logging Verification - Replay Attempt Logged
**Objective:** Verify replay attempts are logged to replay_attempts.log
**Prerequisites:**

- Replay attempt made
- Access to server logs

**Detailed Steps:**

1. Attacker makes replay attempt
2. Replay rejected by server or client
3. Check server logs: `server/logs/replay_attempts.log`
4. Verify log entry exists:
   - Log file exists
   - Entry for replay attempt present
5. Verify log entry structure:
   - `eventType`: "REPLAY_ATTEMPT"
   - `sessionId`: Session identifier
   - `userId`: User ID (if available)
   - `seq`: Sequence number
   - `timestamp`: Message timestamp
   - `reason`: Rejection reason
   - `action`: "REJECTED"
   - `ip`: Client IP (if available)
6. Verify log entry is HMAC-protected (if implemented)

**Expected Outcome:**

- Replay attempt logged
- Log entry contains all required fields
- Log entry is HMAC-protected (if implemented)
- Log entry is structured and parseable

**Evidence to Capture:**

- Log entry from replay_attempts.log
- Field verification
- HMAC verification (if applicable)

**Pass/Fail Criteria:**

- PASS: Replay logged with all required fields
- FAIL: Not logged or missing fields

**PDF Requirements Validated:**

- Logging verification
- Replay attempt logging

---

## TC-ID: REPLAY-021

**Title:** Logging Verification - Client-Side Replay Logged
**Objective:** Verify client-side replay attempts are logged to IndexedDB
**Prerequisites:**

- Replay attempt made on client
- Access to browser IndexedDB

**Detailed Steps:**

1. Bob receives replayed message
2. Client-side validation rejects replay
3. Check IndexedDB: `InfosecCryptoDB.clientLogs`
4. Verify log entry exists:
   - Query IndexedDB for replay events
   - Entry for replay attempt present
5. Verify log entry structure:
   - `timestamp`: ISO timestamp
   - `userId`: User ID
   - `sessionId`: Session identifier
   - `event`: "replay_attempt"
   - `metadata.seq`: Sequence number
   - `metadata.messageTimestamp`: Message timestamp
   - `metadata.reason`: Rejection reason
   - `synced`: false (not yet synced to server)

**Expected Outcome:**

- Client-side replay logged
- Log entry contains all required fields
- Log entry stored in IndexedDB
- Log entry can be synced to server

**Evidence to Capture:**

- IndexedDB log entry
- Field verification
- Log structure verification

**Pass/Fail Criteria:**

- PASS: Client-side replay logged with all required fields
- FAIL: Not logged or missing fields

**PDF Requirements Validated:**

- Logging verification
- Client-side replay logging

---

## TC-ID: REPLAY-022

**Title:** Log Structure Validation - Server Log Format
**Objective:** Verify server replay log structure matches specification
**Prerequisites:**

- Replay attempt made
- Access to server logs

**Detailed Steps:**

1. Attacker makes replay attempt
2. Replay rejected and logged
3. Read log entry from `replay_attempts.log`
4. Verify JSON structure:
   - Valid JSON format
   - All required fields present
   - Field types correct (string, number, etc.)
5. Verify field values:
   - `eventType`: String, value "REPLAY_ATTEMPT"
   - `sessionId`: String, non-empty
   - `seq`: Number, integer
   - `timestamp`: Number, integer (milliseconds)
   - `reason`: String, non-empty
   - `action`: String, value "REJECTED"
6. Verify HMAC protection (if implemented):
   - Log entry includes HMAC
   - HMAC can be verified

**Expected Outcome:**

- Log entry is valid JSON
- All required fields present
- Field types and values correct
- HMAC protection present (if implemented)

**Evidence to Capture:**

- Log entry JSON
- Field verification
- HMAC verification (if applicable)

**Pass/Fail Criteria:**

- PASS: Log structure valid, all fields correct
- FAIL: Invalid structure or missing/incorrect fields

**PDF Requirements Validated:**

- Log structure validation
- Server log format

---

## TC-ID: REPLAY-023

**Title:** Log Structure Validation - Client Log Format
**Objective:** Verify client replay log structure matches specification
**Prerequisites:**

- Replay attempt made on client
- Access to browser IndexedDB

**Detailed Steps:**

1. Bob receives replayed message
2. Client-side validation rejects replay
3. Read log entry from IndexedDB `clientLogs` store
4. Verify object structure:
   - Valid object structure
   - All required fields present
   - Field types correct
5. Verify field values:
   - `id`: Number (auto-increment)
   - `timestamp`: String, ISO format
   - `userId`: String or null
   - `sessionId`: String or null
   - `event`: String, value "replay_attempt"
   - `metadata.seq`: Number or null
   - `metadata.messageTimestamp`: Number or null
   - `metadata.reason`: String or null
   - `synced`: Boolean, false

**Expected Outcome:**

- Log entry is valid object
- All required fields present
- Field types and values correct
- Metadata structure correct

**Evidence to Capture:**

- IndexedDB log entry
- Field verification
- Structure verification

**Pass/Fail Criteria:**

- PASS: Log structure valid, all fields correct
- FAIL: Invalid structure or missing/incorrect fields

**PDF Requirements Validated:**

- Log structure validation
- Client log format

---

## TC-ID: REPLAY-024

**Title:** Log Structure Validation - Multiple Replay Attempts
**Objective:** Verify multiple replay attempts are logged correctly
**Prerequisites:**

- Multiple replay attempts made
- Access to server logs

**Detailed Steps:**

1. Attacker makes 5 replay attempts
2. Each replay rejected and logged
3. Read all log entries from `replay_attempts.log`
4. Verify log entries:
   - 5 log entries present
   - Each entry is valid JSON
   - Each entry has unique timestamp (log time)
   - Each entry has correct structure
5. Verify entry differences:
   - Same `sessionId` (if same session)
   - Same `seq` (if same message)
   - Same `timestamp` (message timestamp)
   - Different log timestamps
   - Same or different `reason` (depending on rejection layer)

**Expected Outcome:**

- Multiple replay attempts logged
- Each entry is valid and structured
- Entries can be distinguished by log timestamp
- All entries follow same structure

**Evidence to Capture:**

- Multiple log entries
- Entry count verification
- Structure verification
- Timestamp comparison

**Pass/Fail Criteria:**

- PASS: All replays logged, entries valid and structured
- FAIL: Missing entries or invalid structure

**PDF Requirements Validated:**

- Log structure validation
- Multiple replay logging

---

## TC-ID: REPLAY-025

**Title:** Log Structure Validation - Different Rejection Reasons
**Objective:** Verify logs capture different rejection reasons correctly
**Prerequisites:**

- Multiple replay attempts with different failure modes
- Access to server logs

**Detailed Steps:**

1. Create replay attempt 1: Stale timestamp (3 minutes ago)
   - Verify log: `reason: "Timestamp out of validity window"`
2. Create replay attempt 2: Duplicate sequence (seq=5, lastSeq=5)
   - Verify log: `reason: "Sequence number must be strictly increasing"`
3. Create replay attempt 3: Duplicate nonce
   - Verify log: `reason: "REPLAY_REJECT: Duplicate nonce detected in session"`
4. Create replay attempt 4: Duplicate messageId
   - Verify log: `reason: "Duplicate messageId detected"`
5. Verify all log entries:
   - Each entry has correct `reason` field
   - `reason` field is descriptive
   - `action` field is "REJECTED" for all
   - All entries are valid JSON

**Expected Outcome:**

- Different rejection reasons logged correctly
- Each reason is descriptive and accurate
- All entries follow same structure
- Logs can be analyzed for attack patterns

**Evidence to Capture:**

- Log entries with different reasons
- Reason field verification
- Structure verification

**Pass/Fail Criteria:**

- PASS: All rejection reasons logged correctly
- FAIL: Missing or incorrect reason fields

**PDF Requirements Validated:**

- Log structure validation
- Rejection reason logging

---

**End of Replay Protection Testcase Suite**
