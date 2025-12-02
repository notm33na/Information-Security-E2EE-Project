# Messaging & Encryption Testcase Suite

## TC-ID: MSG-001

**Title:** Message Envelope Structure Validation - MSG Type
**Objective:** Verify MSG type envelope contains all required fields in correct format
**Prerequisites:**

- Two authenticated test users (Alice and Bob)
- Established session between users
- Browser console access

**Detailed Steps:**

1. Alice sends a text message to Bob
2. Monitor `buildTextMessageEnvelope()` function execution
3. Verify envelope structure:
   - `type`: "MSG" (exact string match)
   - `sessionId`: Valid session identifier (string)
   - `sender`: Alice's userId (string)
   - `receiver`: Bob's userId (string)
   - `ciphertext`: Base64-encoded string (non-empty)
   - `iv`: Base64-encoded string (12 bytes when decoded)
   - `authTag`: Base64-encoded string (16 bytes when decoded)
   - `timestamp`: Number (milliseconds since epoch)
   - `seq`: Number (strictly increasing)
   - `nonce`: Base64-encoded string (12-32 bytes when decoded)
4. Verify no extra unexpected fields present
5. Verify all fields are non-null and non-empty

**Expected Outcome:**

- Envelope contains all required fields
- Field types match specification
- All base64 fields are valid base64 strings
- Envelope structure matches specification

**Evidence to Capture:**

- Complete envelope JSON
- Field type verification
- Base64 decoding verification

**Pass/Fail Criteria:**

- PASS: All required fields present with correct types and valid base64 encoding
- FAIL: Missing fields, wrong types, or invalid base64 encoding

**PDF Requirements Validated:**

- Message envelope structure matches specification
- All required fields present

---

## TC-ID: MSG-002

**Title:** Message Envelope Structure Validation - FILE_META Type
**Objective:** Verify FILE_META type envelope contains all required fields including meta object
**Prerequisites:**

- Two authenticated test users
- Established session
- File to send

**Detailed Steps:**

1. Alice sends a file to Bob
2. Monitor `buildFileMetaEnvelope()` function execution
3. Verify envelope structure:
   - `type`: "FILE_META" (exact string match)
   - All standard fields: sessionId, sender, receiver, ciphertext, iv, authTag, timestamp, seq, nonce
   - `meta`: Object containing:
     - `filename`: String (non-empty)
     - `size`: Number (file size in bytes)
     - `totalChunks`: Number (positive integer)
     - `mimetype`: String (MIME type)
4. Verify meta object is present and contains all required fields
5. Verify meta fields are correct types

**Expected Outcome:**

- FILE_META envelope contains all required fields
- meta object contains filename, size, totalChunks, mimetype
- All field types are correct

**Evidence to Capture:**

- Complete FILE_META envelope JSON
- Meta object verification
- Field type verification

**Pass/Fail Criteria:**

- PASS: All required fields present including complete meta object
- FAIL: Missing fields or incorrect meta structure

**PDF Requirements Validated:**

- FILE_META envelope structure matches specification
- Meta object contains all required file metadata

---

## TC-ID: MSG-003

**Title:** Message Envelope Structure Validation - FILE_CHUNK Type
**Objective:** Verify FILE_CHUNK type envelope contains all required fields including chunk metadata
**Prerequisites:**

- Two authenticated test users
- Established session
- File being sent (chunked)

**Detailed Steps:**

1. Alice sends a file to Bob (file is chunked)
2. Monitor `buildFileChunkEnvelope()` function execution for each chunk
3. Verify envelope structure:
   - `type`: "FILE_CHUNK" (exact string match)
   - All standard fields: sessionId, sender, receiver, ciphertext, iv, authTag, timestamp, seq, nonce
   - `meta`: Object containing:
     - `chunkIndex`: Number (0-based index)
     - `totalChunks`: Number (total number of chunks)
4. Verify meta object is present and contains chunkIndex and totalChunks
5. Verify chunkIndex is within valid range (0 to totalChunks-1)

**Expected Outcome:**

- FILE_CHUNK envelope contains all required fields
- meta object contains chunkIndex and totalChunks
- chunkIndex is valid for the chunk

**Evidence to Capture:**

- Complete FILE_CHUNK envelope JSON
- Meta object verification
- Chunk index validation

**Pass/Fail Criteria:**

- PASS: All required fields present including complete chunk meta object
- FAIL: Missing fields or incorrect chunk meta structure

**PDF Requirements Validated:**

- FILE_CHUNK envelope structure matches specification
- Chunk metadata is correct

---

## TC-ID: MSG-004

**Title:** AES-256-GCM Encryption - Key Import
**Objective:** Verify sendKey is correctly imported as AES-GCM CryptoKey
**Prerequisites:**

- Established session with session keys
- Browser console access

**Detailed Steps:**

1. Alice prepares to send a message
2. Monitor `encryptAESGCM()` function execution
3. Verify key import:
   - Key format: 'raw'
   - Algorithm: { name: 'AES-GCM', length: 256 }
   - Key usage: ['encrypt']
   - Key is 256 bits (32 bytes)
4. Verify CryptoKey object is created successfully
5. Verify key is not extractable (security requirement)

**Expected Outcome:**

- sendKey is successfully imported as AES-GCM CryptoKey
- Key algorithm is AES-GCM with 256-bit length
- Key usage includes 'encrypt'
- Key is 256 bits

**Evidence to Capture:**

- Key import success confirmation
- Key algorithm verification
- Key length verification

**Pass/Fail Criteria:**

- PASS: Key imported correctly as AES-256-GCM with proper algorithm and usage
- FAIL: Key import fails or incorrect algorithm/length

**PDF Requirements Validated:**

- AES-256-GCM encryption uses 256-bit keys
- Keys are imported correctly

---

## TC-ID: MSG-005

**Title:** AES-256-GCM Encryption - IV Generation
**Objective:** Verify each message uses a unique 96-bit IV
**Prerequisites:**

- Established session
- Ability to send multiple messages

**Detailed Steps:**

1. Alice sends message 1 to Bob
2. Capture IV from message 1 envelope
3. Alice sends message 2 to Bob
4. Capture IV from message 2 envelope
5. Alice sends message 3 to Bob
6. Capture IV from message 3 envelope
7. Verify:
   - Each IV is 12 bytes (96 bits) when decoded
   - All IVs are different (uniqueness)
   - IVs are cryptographically random (not predictable)
8. Verify IV generation uses `crypto.getRandomValues()`

**Expected Outcome:**

- Each message has unique 96-bit IV
- IVs are cryptographically random
- No IV reuse across messages

**Evidence to Capture:**

- IV values from multiple messages
- IV length verification (12 bytes)
- Uniqueness verification

**Pass/Fail Criteria:**

- PASS: All IVs are unique, 96-bit, and cryptographically random
- FAIL: IV reuse, incorrect length, or predictable values

**PDF Requirements Validated:**

- Each message uses unique IV
- IV is 96 bits (12 bytes)

---

## TC-ID: MSG-006

**Title:** AES-256-GCM Encryption - Encryption Process
**Objective:** Verify plaintext is correctly encrypted using AES-256-GCM
**Prerequisites:**

- Established session
- Known plaintext message

**Detailed Steps:**

1. Alice prepares plaintext: "Test message"
2. Monitor `encryptAESGCM()` function execution
3. Verify encryption process:
   - Plaintext converted to ArrayBuffer (if string)
   - IV generated (96 bits)
   - Key imported as AES-GCM CryptoKey
   - Encryption performed with:
     - Algorithm: AES-GCM
     - IV: 96-bit random IV
     - Tag length: 128 bits
4. Verify encryption result:
   - Ciphertext is ArrayBuffer
   - AuthTag is ArrayBuffer (16 bytes)
   - Ciphertext length matches plaintext length (no padding)
5. Verify ciphertext is different from plaintext

**Expected Outcome:**

- Plaintext successfully encrypted
- Ciphertext and authTag extracted correctly
- Ciphertext is different from plaintext
- AuthTag is 16 bytes (128 bits)

**Evidence to Capture:**

- Plaintext value
- Ciphertext value (base64)
- AuthTag value (base64)
- Encryption parameters

**Pass/Fail Criteria:**

- PASS: Encryption succeeds, ciphertext differs from plaintext, authTag is 16 bytes
- FAIL: Encryption fails or incorrect output format

**PDF Requirements Validated:**

- AES-256-GCM encryption works correctly
- AuthTag is 128 bits

---

## TC-ID: MSG-007

**Title:** New IV Per Message - Uniqueness Verification
**Objective:** Verify that each message uses a different IV, even for identical plaintext
**Prerequisites:**

- Established session
- Ability to send multiple identical messages

**Detailed Steps:**

1. Alice sends message "Hello" to Bob (message 1)
2. Capture IV1 from envelope
3. Alice sends message "Hello" to Bob (message 2, identical plaintext)
4. Capture IV2 from envelope
5. Alice sends message "Hello" to Bob (message 3, identical plaintext)
6. Capture IV3 from envelope
7. Verify:
   - IV1 ≠ IV2 ≠ IV3 (all different)
   - Each IV is 12 bytes
   - Ciphertexts are different (due to different IVs)
8. Verify IVs are generated using `crypto.getRandomValues()`

**Expected Outcome:**

- Each message has unique IV
- Identical plaintexts produce different ciphertexts
- IVs are cryptographically random

**Evidence to Capture:**

- IV values from all three messages
- Ciphertext values (should differ)
- Uniqueness verification

**Pass/Fail Criteria:**

- PASS: All IVs are unique, ciphertexts differ for identical plaintext
- FAIL: IV reuse or identical ciphertexts for identical plaintext

**PDF Requirements Validated:**

- New IV per message (uniqueness)
- IV prevents identical plaintext from producing identical ciphertext

---

## TC-ID: MSG-008

**Title:** AuthTag Validity - Successful Decryption
**Objective:** Verify valid authTag allows successful decryption
**Prerequisites:**

- Established session
- Valid encrypted message

**Detailed Steps:**

1. Alice sends encrypted message to Bob
2. Bob receives envelope with valid authTag
3. Monitor `decryptAESGCM()` function execution
4. Verify decryption process:
   - Ciphertext and authTag decoded from base64
   - Ciphertext and authTag combined into single ArrayBuffer
   - recvKey imported as AES-GCM CryptoKey
   - Decryption performed with:
     - Algorithm: AES-GCM
     - IV: from envelope
     - Tag length: 128 bits
5. Verify decryption succeeds
6. Verify plaintext matches original message

**Expected Outcome:**

- Decryption succeeds with valid authTag
- Plaintext recovered correctly
- No OperationError thrown

**Evidence to Capture:**

- Decryption success confirmation
- Recovered plaintext
- AuthTag verification

**Pass/Fail Criteria:**

- PASS: Decryption succeeds, plaintext matches original
- FAIL: Decryption fails or incorrect plaintext

**PDF Requirements Validated:**

- Valid authTag allows successful decryption
- AuthTag verification works correctly

---

## TC-ID: MSG-009

**Title:** AuthTag Validity - Invalid AuthTag Rejection
**Objective:** Verify invalid authTag causes decryption failure
**Prerequisites:**

- Established session
- Valid encrypted message

**Detailed Steps:**

1. Alice sends encrypted message to Bob
2. Bob receives envelope
3. Modify authTag in envelope (corrupt or replace)
4. Bob attempts decryption
5. Verify decryption process:
   - Ciphertext and modified authTag decoded
   - Combined into ArrayBuffer
   - Decryption attempted
6. Verify decryption fails:
   - OperationError thrown
   - Error message indicates authentication tag verification failed
   - Plaintext not recovered
7. Verify error is logged
8. Verify message is rejected

**Expected Outcome:**

- Decryption fails with invalid authTag
- OperationError thrown
- Error logged appropriately
- Message rejected

**Evidence to Capture:**

- Decryption failure
- Error message
- Log entry
- Rejection confirmation

**Pass/Fail Criteria:**

- PASS: Invalid authTag causes decryption failure, error logged
- FAIL: Invalid authTag accepted or no error thrown

**PDF Requirements Validated:**

- Invalid authTag is rejected
- AuthTag verification prevents tampering

---

## TC-ID: MSG-010

**Title:** AuthTag Validity - Tampered Ciphertext Detection
**Objective:** Verify tampering with ciphertext is detected via authTag
**Prerequisites:**

- Established session
- Valid encrypted message

**Detailed Steps:**

1. Alice sends encrypted message to Bob
2. Bob receives envelope
3. Modify ciphertext in envelope (change one byte)
4. Keep authTag unchanged
5. Bob attempts decryption
6. Verify decryption fails:
   - OperationError thrown
   - Error indicates authentication tag verification failed
   - Plaintext not recovered
7. Verify error is logged
8. Verify message is rejected

**Expected Outcome:**

- Decryption fails when ciphertext is tampered
- OperationError thrown
- Error logged appropriately
- Message rejected

**Evidence to Capture:**

- Decryption failure
- Error message
- Log entry
- Rejection confirmation

**Pass/Fail Criteria:**

- PASS: Tampered ciphertext causes decryption failure, error logged
- FAIL: Tampered ciphertext accepted or no error thrown

**PDF Requirements Validated:**

- AuthTag detects ciphertext tampering
- Integrity protection works correctly

---

## TC-ID: MSG-011

**Title:** Message Sending via WebSocket - Envelope Transmission
**Objective:** Verify message envelope is correctly sent via WebSocket
**Prerequisites:**

- Established session
- WebSocket connection active
- Network monitoring capability

**Detailed Steps:**

1. Alice sends message to Bob
2. Monitor WebSocket transmission
3. Verify:
   - Event name: "msg:send"
   - Envelope transmitted as JSON
   - All envelope fields present in transmission
   - Connection is WSS (secure WebSocket)
4. Verify envelope structure matches specification
5. Verify no plaintext in transmission (only ciphertext, IV, authTag)

**Expected Outcome:**

- Envelope sent via WebSocket "msg:send" event
- All fields transmitted correctly
- Connection is secure (WSS)
- No plaintext in transmission

**Evidence to Capture:**

- WebSocket event name
- Transmitted envelope JSON
- Connection security (WSS)
- Confirmation no plaintext

**Pass/Fail Criteria:**

- PASS: Envelope sent correctly via WSS, all fields present, no plaintext
- FAIL: Transmission fails, missing fields, or plaintext leaked

**PDF Requirements Validated:**

- Messages sent via WebSocket
- Secure connection (WSS)
- No plaintext in transmission

---

## TC-ID: MSG-012

**Title:** Message Sending via WebSocket - Server Reception
**Objective:** Verify server correctly receives and validates message envelope
**Prerequisites:**

- Established session
- Server logs access
- WebSocket connection active

**Detailed Steps:**

1. Alice sends message to Bob
2. Monitor server-side "msg:send" handler
3. Verify server receives envelope:
   - Event handler triggered
   - Envelope structure validated
   - Required fields checked (type, sessionId, receiver, timestamp, seq)
4. Verify timestamp validation:
   - Timestamp within ±2 minutes window
   - Stale timestamps rejected
5. Verify nonce validation:
   - Nonce present
   - Nonce length valid (12-32 bytes)
   - Nonce hash computed
6. Verify rate limiting applied (if applicable)

**Expected Outcome:**

- Server receives envelope correctly
- Envelope structure validated
- Timestamp validated
- Nonce validated
- Rate limiting enforced

**Evidence to Capture:**

- Server log entries
- Validation results
- Timestamp validation
- Nonce validation

**Pass/Fail Criteria:**

- PASS: Server receives and validates envelope correctly
- FAIL: Reception fails or validation errors

**PDF Requirements Validated:**

- Server receives messages via WebSocket
- Server validates envelope structure

---

## TC-ID: MSG-013

**Title:** Message Receiving - WebSocket Event Handler
**Objective:** Verify client correctly receives message via WebSocket
**Prerequisites:**

- Established session
- WebSocket connection active
- Message sent to receiver

**Detailed Steps:**

1. Alice sends message to Bob
2. Server forwards envelope to Bob
3. Monitor Bob's WebSocket "msg:receive" event handler
4. Verify:
   - Event "msg:receive" triggered
   - Envelope received correctly
   - All envelope fields present
   - Envelope structure matches specification
5. Verify envelope is passed to `handleIncomingMessage()`

**Expected Outcome:**

- Message received via "msg:receive" event
- Envelope structure correct
- All fields present
- Handler function called

**Evidence to Capture:**

- WebSocket event trigger
- Received envelope JSON
- Handler function call
- Field verification

**Pass/Fail Criteria:**

- PASS: Message received correctly, envelope complete, handler called
- FAIL: Reception fails or incomplete envelope

**PDF Requirements Validated:**

- Messages received via WebSocket
- Event handler works correctly

---

## TC-ID: MSG-014

**Title:** Message Receiving - Envelope Structure Validation
**Objective:** Verify received envelope structure is validated before decryption
**Prerequisites:**

- Established session
- Message sent to receiver

**Detailed Steps:**

1. Bob receives message envelope
2. Monitor `validateEnvelopeStructure()` function execution
3. Verify validation checks:
   - Required fields present: type, sessionId, sender, receiver, ciphertext, iv, authTag, timestamp, seq
   - Type is valid: "MSG", "FILE_META", or "FILE_CHUNK"
   - Timestamp is number
   - Sequence number is number
   - Base64 fields are strings: ciphertext, iv, authTag, nonce
   - File messages include meta object
4. Verify invalid structure is rejected:
   - Missing required field → rejection
   - Invalid type → rejection
   - Wrong field types → rejection
5. Verify error logged for invalid structure

**Expected Outcome:**

- Envelope structure validated
- Invalid structures rejected
- Errors logged appropriately
- Validation occurs before decryption

**Evidence to Capture:**

- Validation results
- Rejection cases
- Error logs
- Validation order

**Pass/Fail Criteria:**

- PASS: Structure validated, invalid structures rejected, errors logged
- FAIL: Validation skipped or invalid structures accepted

**PDF Requirements Validated:**

- Envelope structure validation
- Invalid structures rejected

---

## TC-ID: MSG-015

**Title:** Replay Validation During Message Decrypt - Timestamp Check
**Objective:** Verify timestamp freshness is validated before decryption
**Prerequisites:**

- Established session
- Ability to create stale message

**Detailed Steps:**

1. Create message envelope with timestamp = 3 minutes ago (beyond ±2 minute window)
2. Bob receives stale envelope
3. Monitor `handleIncomingMessage()` function execution
4. Verify timestamp validation:
   - `validateTimestamp()` called
   - Age calculated: `Date.now() - envelope.timestamp`
   - Validation fails: `|age| > 120000` (2 minutes)
5. Verify message rejected:
   - Decryption not attempted
   - Error: "Timestamp out of validity window"
   - Error logged
   - Replay attempt logged
6. Verify session keys not used (decryption skipped)

**Expected Outcome:**

- Stale timestamp detected
- Message rejected before decryption
- Error logged
- Replay attempt logged
- Decryption skipped

**Evidence to Capture:**

- Timestamp validation result
- Rejection confirmation
- Error log
- Replay attempt log
- Confirmation decryption skipped

**Pass/Fail Criteria:**

- PASS: Stale timestamp rejected, logged, decryption skipped
- FAIL: Stale timestamp accepted or decryption attempted

**PDF Requirements Validated:**

- Timestamp freshness validation
- Replay protection via timestamp

---

## TC-ID: MSG-016

**Title:** Replay Validation During Message Decrypt - Sequence Number Check
**Objective:** Verify sequence number monotonicity is validated before decryption
**Prerequisites:**

- Established session
- Previous message with seq=5 already processed

**Detailed Steps:**

1. Bob has already processed message with seq=5
2. Create message envelope with seq=5 (duplicate) or seq=4 (decreasing)
3. Bob receives envelope
4. Monitor `handleIncomingMessage()` function execution
5. Verify sequence validation:
   - `loadSession()` called to get lastSeq
   - `sequenceManager.validateSequence()` called
   - Validation fails: `envelope.seq <= lastSeq`
6. Verify message rejected:
   - Decryption not attempted
   - Error: "Sequence number must be strictly increasing"
   - Error logged
   - Replay attempt logged
7. Verify session keys not used (decryption skipped)

**Expected Outcome:**

- Non-monotonic sequence detected
- Message rejected before decryption
- Error logged
- Replay attempt logged
- Decryption skipped

**Evidence to Capture:**

- Sequence validation result
- Rejection confirmation
- Error log
- Replay attempt log
- Confirmation decryption skipped

**Pass/Fail Criteria:**

- PASS: Non-monotonic sequence rejected, logged, decryption skipped
- FAIL: Non-monotonic sequence accepted or decryption attempted

**PDF Requirements Validated:**

- Sequence number monotonicity validation
- Replay protection via sequence numbers

---

## TC-ID: MSG-017

**Title:** Replay Validation During Message Decrypt - Nonce Uniqueness Check
**Objective:** Verify nonce uniqueness is validated before decryption
**Prerequisites:**

- Established session
- Previous message with nonce already processed

**Detailed Steps:**

1. Bob has already processed message with nonce N1
2. Create message envelope with same nonce N1 (replay)
3. Bob receives envelope
4. Monitor `handleIncomingMessage()` function execution
5. Verify nonce validation:
   - Nonce presence checked
   - Nonce decoded from base64
   - Nonce length validated (12-32 bytes)
   - Nonce hash computed: `SHA-256(nonceBytes)`
   - `isNonceUsed()` called to check uniqueness
   - Validation fails: nonce already used
6. Verify message rejected:
   - Decryption not attempted
   - Error: "Duplicate nonce for this session"
   - Error logged
   - Replay attempt logged
7. Verify session keys not used (decryption skipped)

**Expected Outcome:**

- Duplicate nonce detected
- Message rejected before decryption
- Error logged
- Replay attempt logged
- Decryption skipped

**Evidence to Capture:**

- Nonce validation result
- Nonce hash computation
- Rejection confirmation
- Error log
- Replay attempt log
- Confirmation decryption skipped

**Pass/Fail Criteria:**

- PASS: Duplicate nonce rejected, logged, decryption skipped
- FAIL: Duplicate nonce accepted or decryption attempted

**PDF Requirements Validated:**

- Nonce uniqueness validation
- Replay protection via nonce

---

## TC-ID: MSG-018

**Title:** Replay Validation During Message Decrypt - All Layers Pass
**Objective:** Verify message passes all replay validation layers before decryption
**Prerequisites:**

- Established session
- Valid message with fresh timestamp, monotonic sequence, unique nonce

**Detailed Steps:**

1. Bob receives valid message envelope:
   - Timestamp: current time (within ±2 minutes)
   - Sequence: lastSeq + 1 (monotonic)
   - Nonce: unique (not previously used)
2. Monitor `handleIncomingMessage()` function execution
3. Verify all validation layers:
   - Layer 1: Structure validation → PASS
   - Layer 2: Timestamp validation → PASS
   - Layer 3: Sequence validation → PASS
   - Layer 4: Nonce validation → PASS
4. Verify decryption proceeds:
   - recvKey loaded
   - Decryption attempted
   - Plaintext recovered
5. Verify session state updated after successful decryption

**Expected Outcome:**

- All validation layers pass
- Decryption proceeds
- Plaintext recovered
- Session state updated

**Evidence to Capture:**

- Validation results for each layer
- Decryption success
- Recovered plaintext
- Session state update

**Pass/Fail Criteria:**

- PASS: All validations pass, decryption succeeds, state updated
- FAIL: Validation fails or decryption fails

**PDF Requirements Validated:**

- Multi-layer replay protection
- Successful message processing

---

## TC-ID: MSG-019

**Title:** Sequence Number Update - IndexedDB Update
**Objective:** Verify sequence number is updated in IndexedDB after successful decryption
**Prerequisites:**

- Established session
- Valid message received

**Detailed Steps:**

1. Bob receives valid message with seq=10
2. Bob's current lastSeq = 9 (from IndexedDB)
3. Monitor `updateSessionSeq()` function execution
4. Verify sequence update:
   - `loadSession()` called to get current session
   - `session.lastSeq` updated to 10
   - `session.lastTimestamp` updated to current time
   - `session.updatedAt` updated
   - Session re-encrypted and stored in IndexedDB
5. Verify IndexedDB update:
   - Session record updated
   - lastSeq = 10
   - lastTimestamp updated
6. Verify next message with seq=10 or less will be rejected

**Expected Outcome:**

- Sequence number updated in IndexedDB
- lastSeq = 10
- lastTimestamp updated
- Session record persisted
- Future replays with seq <= 10 rejected

**Evidence to Capture:**

- IndexedDB session record before update
- IndexedDB session record after update
- lastSeq value
- lastTimestamp value
- Confirmation of persistence

**Pass/Fail Criteria:**

- PASS: Sequence updated in IndexedDB, persisted, future replays rejected
- FAIL: Sequence not updated or not persisted

**PDF Requirements Validated:**

- Sequence number update in IndexedDB
- Session state persistence

---

## TC-ID: MSG-020

**Title:** Sequence Number Update - Nonce Storage
**Objective:** Verify nonce hash is stored in IndexedDB after successful decryption
**Prerequisites:**

- Established session
- Valid message received with unique nonce

**Detailed Steps:**

1. Bob receives valid message with nonce N1
2. Monitor `storeUsedNonce()` function execution
3. Verify nonce storage:
   - Nonce hash computed: `SHA-256(nonceBytes)` → hex string
   - `storeUsedNonce(sessionId, nonceHash)` called
   - Nonce hash added to session's usedNonces array
   - Array bounded to 200 entries (oldest removed if exceeded)
   - Session re-encrypted and stored in IndexedDB
4. Verify IndexedDB update:
   - Session record updated
   - usedNonces array contains nonceHash
   - Array length <= 200
5. Verify future message with same nonce will be rejected

**Expected Outcome:**

- Nonce hash stored in IndexedDB
- usedNonces array updated
- Array bounded to 200 entries
- Future replays with same nonce rejected

**Evidence to Capture:**

- Nonce hash value
- IndexedDB session record (usedNonces array)
- Array length
- Confirmation of persistence

**Pass/Fail Criteria:**

- PASS: Nonce hash stored, array updated, bounded, future replays rejected
- FAIL: Nonce hash not stored or not persisted

**PDF Requirements Validated:**

- Nonce storage in IndexedDB
- Nonce tracking for replay protection

---

## TC-ID: MSG-021

**Title:** Timestamp Enforcement - Stale Message Rejection
**Objective:** Verify messages older than 2 minutes are rejected
**Prerequisites:**

- Established session
- Ability to create stale timestamp

**Detailed Steps:**

1. Create message envelope with timestamp = 3 minutes ago
2. Bob receives stale envelope
3. Monitor timestamp validation
4. Verify validation:
   - Age calculated: `Date.now() - envelope.timestamp`
   - Age = 180000 ms (3 minutes)
   - Validation: `|age| > 120000` → FAIL
5. Verify rejection:
   - Message rejected
   - Error: "Timestamp out of validity window"
   - `logTimestampFailure()` called
   - `logReplayAttempt()` called
   - `triggerReplayDetection()` called
6. Verify decryption not attempted

**Expected Outcome:**

- Stale timestamp detected
- Message rejected
- Errors logged
- Replay detection triggered
- Decryption skipped

**Evidence to Capture:**

- Timestamp age calculation
- Validation result
- Rejection confirmation
- Error logs
- Confirmation decryption skipped

**Pass/Fail Criteria:**

- PASS: Stale timestamp rejected, logged, decryption skipped
- FAIL: Stale timestamp accepted or decryption attempted

**PDF Requirements Validated:**

- Timestamp freshness enforcement
- ±2 minute window enforced

---

## TC-ID: MSG-022

**Title:** Timestamp Enforcement - Future Message Rejection
**Objective:** Verify messages from future (>2 minutes) are rejected
**Prerequisites:**

- Established session
- Ability to create future timestamp

**Detailed Steps:**

1. Create message envelope with timestamp = 3 minutes in future
2. Bob receives future envelope
3. Monitor timestamp validation
4. Verify validation:
   - Age calculated: `Date.now() - envelope.timestamp`
   - Age = -180000 ms (negative, 3 minutes in future)
   - Validation: `|age| > 120000` → FAIL
5. Verify rejection:
   - Message rejected
   - Error: "Timestamp out of validity window"
   - Errors logged
   - Replay detection triggered
6. Verify decryption not attempted

**Expected Outcome:**

- Future timestamp detected
- Message rejected
- Errors logged
- Replay detection triggered
- Decryption skipped

**Evidence to Capture:**

- Timestamp age calculation
- Validation result
- Rejection confirmation
- Error logs
- Confirmation decryption skipped

**Pass/Fail Criteria:**

- PASS: Future timestamp rejected, logged, decryption skipped
- FAIL: Future timestamp accepted or decryption attempted

**PDF Requirements Validated:**

- Timestamp freshness enforcement
- Clock skew protection

---

## TC-ID: MSG-023

**Title:** Timestamp Enforcement - Valid Timestamp Acceptance
**Objective:** Verify messages within ±2 minute window are accepted
**Prerequisites:**

- Established session
- Valid message with current timestamp

**Detailed Steps:**

1. Create message envelope with timestamp = current time (within ±2 minutes)
2. Bob receives valid envelope
3. Monitor timestamp validation
4. Verify validation:
   - Age calculated: `Date.now() - envelope.timestamp`
   - Age = 5000 ms (5 seconds ago, within window)
   - Validation: `|age| <= 120000` → PASS
5. Verify acceptance:
   - Message accepted
   - Validation passes
   - Decryption proceeds
6. Verify no errors logged for timestamp

**Expected Outcome:**

- Valid timestamp accepted
- Validation passes
- Decryption proceeds
- No timestamp errors logged

**Evidence to Capture:**

- Timestamp age calculation
- Validation result
- Acceptance confirmation
- Decryption success
- Confirmation no errors logged

**Pass/Fail Criteria:**

- PASS: Valid timestamp accepted, decryption proceeds
- FAIL: Valid timestamp rejected or decryption fails

**PDF Requirements Validated:**

- Timestamp validation allows valid messages
- ±2 minute window correctly enforced

---

## TC-ID: MSG-024

**Title:** Nonce Enforcement - Missing Nonce Rejection
**Objective:** Verify messages without nonce are rejected
**Prerequisites:**

- Established session
- Ability to create message without nonce

**Detailed Steps:**

1. Create message envelope without nonce field
2. Bob receives envelope
3. Monitor nonce validation
4. Verify validation:
   - `envelope.nonce` checked
   - Nonce is missing → validation fails
5. Verify rejection:
   - Message rejected
   - Error: "Missing nonce"
   - `logReplayAttempt()` called
   - `triggerReplayDetection()` called
6. Verify decryption not attempted

**Expected Outcome:**

- Missing nonce detected
- Message rejected
- Errors logged
- Replay detection triggered
- Decryption skipped

**Evidence to Capture:**

- Nonce presence check
- Validation result
- Rejection confirmation
- Error logs
- Confirmation decryption skipped

**Pass/Fail Criteria:**

- PASS: Missing nonce rejected, logged, decryption skipped
- FAIL: Missing nonce accepted or decryption attempted

**PDF Requirements Validated:**

- Nonce presence enforced
- Missing nonce causes rejection

---

## TC-ID: MSG-025

**Title:** Nonce Enforcement - Invalid Nonce Length Rejection
**Objective:** Verify nonces with invalid length (not 12-32 bytes) are rejected
**Prerequisites:**

- Established session
- Ability to create message with invalid nonce length

**Detailed Steps:**

1. Create message envelope with nonce = 8 bytes (too short)
2. Bob receives envelope
3. Monitor nonce validation
4. Verify validation:
   - Nonce decoded from base64
   - Nonce length checked: `nonceLength < 12` → FAIL
5. Verify rejection:
   - Message rejected
   - Error: "Invalid nonce length: 8 (expected 12-32 bytes)"
   - Errors logged
   - Replay detection triggered
6. Repeat with nonce = 40 bytes (too long)
7. Verify rejection for length > 32 bytes

**Expected Outcome:**

- Invalid nonce length detected
- Message rejected
- Errors logged
- Replay detection triggered
- Decryption skipped

**Evidence to Capture:**

- Nonce length check
- Validation result
- Rejection confirmation
- Error logs
- Confirmation decryption skipped

**Pass/Fail Criteria:**

- PASS: Invalid nonce length rejected, logged, decryption skipped
- FAIL: Invalid nonce length accepted or decryption attempted

**PDF Requirements Validated:**

- Nonce length validation (12-32 bytes)
- Invalid lengths rejected

---

## TC-ID: MSG-026

**Title:** Nonce Enforcement - Valid Nonce Acceptance
**Objective:** Verify nonces with valid length (12-32 bytes) are accepted
**Prerequisites:**

- Established session
- Valid message with nonce of valid length

**Detailed Steps:**

1. Create message envelope with nonce = 16 bytes (valid)
2. Bob receives envelope
3. Monitor nonce validation
4. Verify validation:
   - Nonce decoded from base64
   - Nonce length checked: `12 <= nonceLength <= 32` → PASS
   - Nonce hash computed
   - Uniqueness checked → PASS (not previously used)
5. Verify acceptance:
   - Message accepted
   - Validation passes
   - Decryption proceeds
6. Verify nonce hash stored after successful decryption

**Expected Outcome:**

- Valid nonce accepted
- Validation passes
- Decryption proceeds
- Nonce hash stored

**Evidence to Capture:**

- Nonce length check
- Validation result
- Acceptance confirmation
- Decryption success
- Nonce hash storage

**Pass/Fail Criteria:**

- PASS: Valid nonce accepted, decryption proceeds, hash stored
- FAIL: Valid nonce rejected or decryption fails

**PDF Requirements Validated:**

- Nonce validation allows valid nonces
- Valid length range (12-32 bytes) enforced

---

## TC-ID: MSG-027

**Title:** Server Stores ONLY Ciphertext + IV + Metadata - No Plaintext
**Objective:** Verify server never stores plaintext, only metadata
**Prerequisites:**

- Established session
- Server database access
- Message sent

**Detailed Steps:**

1. Alice sends message "Secret message" to Bob
2. Monitor server-side message storage
3. Verify MessageMeta document stored:
   - `messageId`: Generated
   - `sessionId`: Session identifier
   - `sender`: Alice's userId
   - `receiver`: Bob's userId
   - `type`: "MSG"
   - `timestamp`: Message timestamp
   - `seq`: Sequence number
   - `nonceHash`: SHA-256 hash of nonce
   - `meta`: File metadata (if applicable)
   - `delivered`: Boolean
4. Verify server does NOT store:
   - `ciphertext`: NOT in database
   - `iv`: NOT in database
   - `authTag`: NOT in database
   - `nonce`: NOT in database (only nonceHash)
   - `plaintext`: NOT in database
5. Verify database query confirms no plaintext fields

**Expected Outcome:**

- Server stores only metadata
- No ciphertext, IV, authTag, or nonce stored
- No plaintext stored
- Only nonceHash stored (not nonce itself)

**Evidence to Capture:**

- MessageMeta document from database
- Confirmation of stored fields
- Confirmation of missing fields (ciphertext, IV, authTag, nonce, plaintext)
- Database query results

**Pass/Fail Criteria:**

- PASS: Only metadata stored, no ciphertext/IV/authTag/nonce/plaintext
- FAIL: Ciphertext, IV, authTag, nonce, or plaintext stored

**PDF Requirements Validated:**

- Server stores only metadata
- No sensitive data stored on server

---

## TC-ID: MSG-028

**Title:** Server Stores ONLY Ciphertext + IV + Metadata - Metadata Fields Verification
**Objective:** Verify server stores correct metadata fields
**Prerequisites:**

- Established session
- Server database access
- Message sent

**Detailed Steps:**

1. Alice sends message to Bob
2. Monitor server-side message storage
3. Verify MessageMeta document contains:
   - `messageId`: Unique identifier (format: sessionId:seq:timestamp)
   - `sessionId`: Session identifier
   - `sender`: ObjectId reference to User
   - `receiver`: ObjectId reference to User
   - `type`: "MSG", "FILE_META", or "FILE_CHUNK"
   - `timestamp`: Number (milliseconds)
   - `seq`: Number
   - `nonceHash`: String (SHA-256 hash, hex)
   - `meta`: Object (for file messages)
   - `delivered`: Boolean
   - `deliveredAt`: Date (if delivered)
   - `metadataHash`: String (SHA-256 hash of metadata)
4. Verify all metadata fields are present and correct types
5. Verify metadataHash is computed correctly

**Expected Outcome:**

- All metadata fields stored correctly
- Field types are correct
- metadataHash computed and stored
- No missing required fields

**Evidence to Capture:**

- MessageMeta document from database
- Field verification
- Type verification
- metadataHash verification

**Pass/Fail Criteria:**

- PASS: All metadata fields stored with correct types
- FAIL: Missing fields or incorrect types

**PDF Requirements Validated:**

- Server metadata storage structure
- All required metadata fields present

---

## TC-ID: MSG-029

**Title:** No Plaintext Leaks - Client-Side Memory Clearing
**Objective:** Verify plaintext is cleared from memory after encryption
**Prerequisites:**

- Established session
- Browser memory inspection capability

**Detailed Steps:**

1. Alice prepares plaintext: "Secret message"
2. Monitor `sendEncryptedMessage()` function execution
3. Verify encryption process:
   - Plaintext encrypted
   - Ciphertext generated
4. Verify memory clearing:
   - `clearPlaintextAfterEncryption()` called
   - Plaintext cleared from memory (best-effort)
   - Plaintext not accessible after encryption
5. Verify envelope contains only ciphertext (no plaintext)
6. Verify plaintext not in WebSocket transmission

**Expected Outcome:**

- Plaintext cleared from memory after encryption
- Envelope contains only ciphertext
- No plaintext in WebSocket transmission
- Plaintext not accessible after encryption

**Evidence to Capture:**

- Memory clearing function call
- Envelope content verification
- WebSocket transmission verification
- Confirmation no plaintext accessible

**Pass/Fail Criteria:**

- PASS: Plaintext cleared, no plaintext in envelope or transmission
- FAIL: Plaintext accessible or present in transmission

**PDF Requirements Validated:**

- Plaintext cleared from memory
- No plaintext leaks

---

## TC-ID: MSG-030

**Title:** No Plaintext Leaks - Server-Side Verification
**Objective:** Verify server never receives or stores plaintext
**Prerequisites:**

- Established session
- Server logs access
- Network monitoring capability

**Detailed Steps:**

1. Alice sends message "Secret message" to Bob
2. Monitor server-side reception
3. Verify server receives:
   - Envelope with ciphertext, IV, authTag
   - No plaintext in envelope
4. Verify server storage:
   - MessageMeta document created
   - No plaintext field in document
   - Database query confirms no plaintext
5. Verify server logs:
   - No plaintext in log entries
   - Only metadata logged
6. Verify server forwarding:
   - Envelope forwarded to Bob
   - No plaintext in forwarded envelope

**Expected Outcome:**

- Server receives no plaintext
- Server stores no plaintext
- Server logs contain no plaintext
- Server forwards no plaintext

**Evidence to Capture:**

- Server-received envelope
- MessageMeta document
- Server logs
- Forwarded envelope
- Database query results

**Pass/Fail Criteria:**

- PASS: Server never receives, stores, logs, or forwards plaintext
- FAIL: Plaintext present in server data or logs

**PDF Requirements Validated:**

- Server never sees plaintext
- No plaintext leaks on server

---

## TC-ID: MSG-031

**Title:** Client Decryption Path - Key Loading
**Objective:** Verify recvKey is correctly loaded from IndexedDB for decryption
**Prerequisites:**

- Established session
- Valid encrypted message received

**Detailed Steps:**

1. Bob receives encrypted message
2. Monitor `handleIncomingMessage()` function execution
3. Verify key loading:
   - `loadSession()` called to get session
   - `getRecvKey(sessionId, userId)` called
   - recvKey retrieved from IndexedDB
   - Key is 256 bits (32 bytes)
4. Verify key import:
   - Key imported as AES-GCM CryptoKey
   - Algorithm: { name: 'AES-GCM', length: 256 }
   - Key usage: ['decrypt']
5. Verify key is correct for session

**Expected Outcome:**

- recvKey loaded from IndexedDB
- Key is 256 bits
- Key imported correctly as AES-GCM
- Key usage includes 'decrypt'

**Evidence to Capture:**

- Key loading function calls
- Key retrieval from IndexedDB
- Key length verification
- Key import verification

**Pass/Fail Criteria:**

- PASS: recvKey loaded correctly, 256 bits, imported as AES-GCM
- FAIL: Key loading fails or incorrect key

**PDF Requirements Validated:**

- Client decryption path loads correct key
- Key is 256 bits

---

## TC-ID: MSG-032

**Title:** Client Decryption Path - Base64 Decoding
**Objective:** Verify envelope base64 fields are correctly decoded before decryption
**Prerequisites:**

- Established session
- Valid encrypted message received

**Detailed Steps:**

1. Bob receives encrypted message envelope
2. Monitor `handleIncomingMessage()` function execution
3. Verify base64 decoding:
   - `ciphertext`: Decoded from base64 → ArrayBuffer
   - `iv`: Decoded from base64 → ArrayBuffer → Uint8Array (12 bytes)
   - `authTag`: Decoded from base64 → ArrayBuffer (16 bytes)
4. Verify decoded lengths:
   - IV: 12 bytes (96 bits)
   - AuthTag: 16 bytes (128 bits)
   - Ciphertext: Variable length
5. Verify decoded data is correct format for Web Crypto API

**Expected Outcome:**

- Base64 fields decoded correctly
- IV is 12 bytes (Uint8Array)
- AuthTag is 16 bytes (ArrayBuffer)
- Ciphertext is ArrayBuffer
- Data ready for decryption

**Evidence to Capture:**

- Base64 decoding process
- Decoded IV length
- Decoded authTag length
- Decoded ciphertext
- Data format verification

**Pass/Fail Criteria:**

- PASS: All base64 fields decoded correctly with correct lengths
- FAIL: Decoding fails or incorrect lengths

**PDF Requirements Validated:**

- Base64 decoding works correctly
- Decoded data has correct format

---

## TC-ID: MSG-033

**Title:** Client Decryption Path - AES-GCM Decryption
**Objective:** Verify plaintext is correctly decrypted using AES-256-GCM
**Prerequisites:**

- Established session
- Valid encrypted message received

**Detailed Steps:**

1. Bob receives encrypted message
2. Monitor `decryptAESGCM()` or `decryptAESGCMToString()` function execution
3. Verify decryption process:
   - Ciphertext and authTag combined into single ArrayBuffer
   - recvKey imported as AES-GCM CryptoKey
   - Decryption performed with:
     - Algorithm: AES-GCM
     - IV: from envelope (96 bits)
     - Tag length: 128 bits
4. Verify decryption result:
   - Plaintext recovered as ArrayBuffer
   - For text messages: Converted to UTF-8 string
   - Plaintext matches original message
5. Verify authTag verified during decryption

**Expected Outcome:**

- Decryption succeeds
- Plaintext recovered correctly
- AuthTag verified
- Plaintext matches original message

**Evidence to Capture:**

- Decryption process
- Recovered plaintext
- AuthTag verification
- Plaintext comparison with original

**Pass/Fail Criteria:**

- PASS: Decryption succeeds, plaintext matches original
- FAIL: Decryption fails or incorrect plaintext

**PDF Requirements Validated:**

- Client decryption path works correctly
- AES-256-GCM decryption successful

---

## TC-ID: MSG-034

**Title:** Client Decryption Path - Error Handling
**Objective:** Verify decryption errors are handled correctly
**Prerequisites:**

- Established session
- Message with invalid authTag or tampered ciphertext

**Detailed Steps:**

1. Bob receives message with invalid authTag
2. Monitor `decryptAESGCM()` function execution
3. Verify error handling:
   - Decryption attempted
   - OperationError thrown (authTag verification failed)
   - Error caught in try-catch
   - `logDecryptionError()` called
   - `triggerInvalidSignature()` called (if auth tag fails)
4. Verify error response:
   - User-friendly error message returned
   - Technical error logged
   - Error returned to caller: `{ valid: false, error: userMessage, technicalError: technicalMessage }`
5. Verify no plaintext returned on error

**Expected Outcome:**

- Decryption errors handled gracefully
- Errors logged appropriately
- User-friendly error returned
- Invalid signature detection triggered
- No plaintext returned on error

**Evidence to Capture:**

- Error handling process
- Error logs
- Error response
- Invalid signature trigger
- Confirmation no plaintext returned

**Pass/Fail Criteria:**

- PASS: Errors handled, logged, user-friendly message returned
- FAIL: Errors not handled or plaintext returned on error

**PDF Requirements Validated:**

- Client decryption error handling
- Errors logged and reported correctly

---

## TC-ID: MSG-035

**Title:** IndexedDB Session Updates - Sequence Number Persistence
**Objective:** Verify sequence number update persists in IndexedDB
**Prerequisites:**

- Established session
- Valid message received
- IndexedDB access

**Detailed Steps:**

1. Bob's current lastSeq = 5 (from IndexedDB)
2. Bob receives message with seq=6
3. Monitor `updateSessionSeq()` function execution
4. Verify IndexedDB update:
   - Session loaded from IndexedDB
   - `session.lastSeq` updated to 6
   - `session.lastTimestamp` updated to current time
   - Session re-encrypted and stored
5. Verify persistence:
   - Query IndexedDB for session
   - Verify lastSeq = 6
   - Verify lastTimestamp updated
6. Verify persistence survives page reload:
   - Reload page
   - Load session from IndexedDB
   - Verify lastSeq = 6

**Expected Outcome:**

- Sequence number updated in IndexedDB
- Update persists
- Persistence survives page reload
- lastSeq = 6 after update

**Evidence to Capture:**

- IndexedDB session record before update
- IndexedDB session record after update
- Persistence verification
- Page reload verification

**Pass/Fail Criteria:**

- PASS: Sequence updated, persisted, survives reload
- FAIL: Update not persisted or lost on reload

**PDF Requirements Validated:**

- IndexedDB session updates persist
- Sequence number persistence

---

## TC-ID: MSG-036

**Title:** IndexedDB Session Updates - Nonce Storage
**Objective:** Verify used nonces are stored in IndexedDB session metadata
**Prerequisites:**

- Established session
- Valid message received with nonce
- IndexedDB access

**Detailed Steps:**

1. Bob receives message with nonce
2. Monitor `storeUsedNonce()` function execution
3. Verify nonce hash computed (SHA-256 of nonce bytes)
4. Verify IndexedDB update:
   - Session loaded from IndexedDB
   - Nonce hash added to `session.usedNonces` array
   - Array bounded to 200 entries (oldest removed if exceeded)
   - Session re-encrypted and stored
5. Verify persistence:
   - Query IndexedDB for session
   - Verify nonce hash in usedNonces array
6. Verify duplicate nonce detection:
   - Attempt to receive same nonce again
   - Verify `isNonceUsed()` returns true
   - Verify message rejected as duplicate

**Expected Outcome:**

- Nonce hash stored in IndexedDB session metadata
- Storage persists
- Duplicate nonce detection works
- Array bounded to 200 entries

**Evidence to Capture:**

- IndexedDB session record before nonce storage
- IndexedDB session record after nonce storage
- Nonce hash value
- Duplicate nonce rejection

**Pass/Fail Criteria:**

- PASS: Nonce stored, persisted, duplicate detection works
- FAIL: Nonce not stored or duplicate detection fails

**PDF Requirements Validated:**

- IndexedDB nonce tracking
- Nonce uniqueness enforcement

---

## TC-ID: MSG-037

**Title:** Server Metadata Storage - No Ciphertext Storage
**Objective:** Verify server does NOT store ciphertext in MongoDB
**Prerequisites:**

- Test user sending message
- Access to MongoDB database
- Message sent via WebSocket

**Detailed Steps:**

1. Alice sends encrypted message to Bob
2. Server receives message via `msg:send` event
3. Monitor `MessageMeta` document creation
4. Verify MongoDB document structure:
   - `messageId`: Present
   - `sessionId`: Present
   - `sender`: Present
   - `receiver`: Present
   - `type`: Present
   - `timestamp`: Present
   - `seq`: Present
   - `nonceHash`: Present
   - `meta`: Present (if applicable)
5. Verify ciphertext NOT stored:
   - Query MongoDB for MessageMeta document
   - Verify NO `ciphertext` field
   - Verify NO `iv` field
   - Verify NO `authTag` field
   - Verify NO `nonce` field (only `nonceHash`)
6. Verify envelope forwarded intact:
   - Check WebSocket forwarding
   - Verify envelope contains ciphertext, iv, authTag, nonce
   - Verify server acts as relay only

**Expected Outcome:**

- Server stores only metadata fields
- Ciphertext, IV, authTag, nonce NOT stored
- Only nonceHash stored (for replay protection)
- Envelope forwarded with all encryption fields

**Evidence to Capture:**

- MongoDB MessageMeta document
- Verification of missing ciphertext/iv/authTag fields
- WebSocket forwarded envelope (with ciphertext)

**Pass/Fail Criteria:**

- PASS: Only metadata stored, ciphertext not stored, envelope forwarded intact
- FAIL: Ciphertext stored or envelope not forwarded correctly

**PDF Requirements Validated:**

- Server stores ONLY metadata
- No plaintext or ciphertext storage

---

## TC-ID: MSG-038

**Title:** Server Metadata Storage - No Plaintext Leaks
**Objective:** Verify server never receives or stores plaintext
**Prerequisites:**

- Test user sending message
- Access to server logs
- Network monitoring capability

**Detailed Steps:**

1. Alice sends encrypted message "Hello Bob"
2. Monitor network traffic:
   - Capture WebSocket `msg:send` event
   - Verify envelope contains only ciphertext (base64)
   - Verify no plaintext in network traffic
3. Monitor server processing:
   - Check server logs for message handling
   - Verify no plaintext in logs
   - Verify no plaintext in console output
4. Monitor MongoDB storage:
   - Query MessageMeta document
   - Verify no plaintext fields
   - Verify no plaintext in metadata
5. Verify server cannot decrypt:
   - Server has no access to session keys
   - Server cannot decrypt ciphertext
   - Server only forwards envelope

**Expected Outcome:**

- No plaintext in network traffic
- No plaintext in server logs
- No plaintext in MongoDB
- Server cannot decrypt messages

**Evidence to Capture:**

- Network traffic capture (WebSocket)
- Server logs
- MongoDB document
- Confirmation server cannot decrypt

**Pass/Fail Criteria:**

- PASS: No plaintext leaks anywhere, server cannot decrypt
- FAIL: Plaintext found in logs, network, or database

**PDF Requirements Validated:**

- No plaintext leaks
- Server acts as relay only

---

## TC-ID: MSG-039

**Title:** Client Decryption Path - Successful Text Message
**Objective:** Verify complete decryption path for text message
**Prerequisites:**

- Established session with valid keys
- Encrypted message received
- Browser console access

**Detailed Steps:**

1. Bob receives encrypted message envelope
2. Monitor `handleIncomingMessage()` execution
3. Verify structure validation passes
4. Verify timestamp validation passes
5. Verify sequence validation passes
6. Verify nonce validation passes
7. Verify session loaded from IndexedDB
8. Verify recvKey retrieved
9. Verify base64 decoding:
   - `ciphertext` → ArrayBuffer
   - `iv` → Uint8Array (12 bytes)
   - `authTag` → ArrayBuffer (16 bytes)
10. Verify decryption:
    - `decryptAESGCMToString()` called
    - recvKey imported as AES-GCM key
    - Ciphertext + authTag combined
    - Decryption succeeds
    - Plaintext string recovered
11. Verify sequence update:
    - `updateSessionSeq()` called
    - lastSeq updated in IndexedDB
12. Verify nonce storage:
    - `storeUsedNonce()` called
    - Nonce hash stored
13. Verify plaintext returned to caller

**Expected Outcome:**

- All validation layers pass
- Decryption succeeds
- Plaintext recovered correctly
- Session state updated
- Nonce tracked

**Evidence to Capture:**

- Decryption function execution
- Plaintext recovery
- Session update
- Nonce storage

**Pass/Fail Criteria:**

- PASS: Complete decryption path succeeds, plaintext recovered
- FAIL: Any step fails or plaintext incorrect

**PDF Requirements Validated:**

- Client decryption path
- Successful message decryption

---

## TC-ID: MSG-040

**Title:** Client Decryption Path - File Chunk Decryption
**Objective:** Verify decryption path for file chunk messages
**Prerequisites:**

- Established session with valid keys
- FILE_CHUNK envelope received
- Browser console access

**Detailed Steps:**

1. Bob receives FILE_CHUNK envelope
2. Monitor `handleIncomingMessage()` execution
3. Verify structure validation passes (includes meta.chunkIndex, meta.totalChunks)
4. Verify timestamp validation passes
5. Verify sequence validation passes
6. Verify nonce validation passes
7. Verify session loaded from IndexedDB
8. Verify recvKey retrieved
9. Verify base64 decoding:
   - `ciphertext` → ArrayBuffer
   - `iv` → Uint8Array (12 bytes)
   - `authTag` → ArrayBuffer (16 bytes)
10. Verify decryption:
    - `decryptAESGCM()` called (not decryptAESGCMToString)
    - recvKey imported as AES-GCM key
    - Ciphertext + authTag combined
    - Decryption succeeds
    - Plaintext ArrayBuffer recovered (not string)
11. Verify sequence update:
    - `updateSessionSeq()` called
    - lastSeq updated in IndexedDB
12. Verify nonce storage:
    - `storeUsedNonce()` called
    - Nonce hash stored
13. Verify plaintext ArrayBuffer returned to caller
14. Verify chunk can be combined with other chunks

**Expected Outcome:**

- All validation layers pass
- Decryption succeeds
- Plaintext ArrayBuffer recovered correctly
- Session state updated
- Nonce tracked
- Chunk ready for file reconstruction

**Evidence to Capture:**

- Decryption function execution
- Plaintext ArrayBuffer recovery
- Session update
- Nonce storage
- Chunk metadata

**Pass/Fail Criteria:**

- PASS: Complete decryption path succeeds, ArrayBuffer recovered
- FAIL: Any step fails or ArrayBuffer incorrect

**PDF Requirements Validated:**

- Client decryption path for files
- File chunk decryption

---

**End of Messaging Encryption Testcase Suite**
