# Key Exchange Protocol (KEP) Testcase Suite

## TC-ID: KEP-001

**Title:** KEP_INIT Message Structure Validation
**Objective:** Verify KEP_INIT message contains all required fields in correct format
**Prerequisites:**

- Two authenticated test users (Alice and Bob)
- Identity keys generated for both users
- Browser console access

**Detailed Steps:**

1. Alice initiates key exchange with Bob
2. Monitor `buildKEPInit()` function execution
3. Verify KEP_INIT message structure:
   - `type`: "KEP_INIT" (exact string match)
   - `from`: Alice's userId (string)
   - `to`: Bob's userId (string)
   - `sessionId`: Valid session identifier (string)
   - `ephPub`: JWK object with kty="EC", crv="P-256", x, y (base64)
   - `signature`: Base64-encoded string
   - `timestamp`: Number (milliseconds since epoch)
   - `seq`: Number (should be 1 for KEP_INIT)
   - `nonce`: Base64-encoded string
4. Verify no extra fields present
5. Verify all fields are non-null and non-empty

**Expected Outcome:**

- KEP_INIT message contains all required fields
- Field types match specification
- seq equals 1 for initial message
- All fields are properly formatted

**Evidence to Capture:**

- Complete KEP_INIT message JSON
- Field type verification
- Sequence number value

**Pass/Fail Criteria:**

- PASS: All required fields present with correct types and values
- FAIL: Missing fields, wrong types, or invalid values

**PDF Requirements Validated:**

- KEP_INIT message structure matches specification
- Required fields: type, from, to, sessionId, ephPub, signature, timestamp, seq, nonce

---

## TC-ID: KEP-002

**Title:** KEP_RESPONSE Message Structure Validation
**Objective:** Verify KEP_RESPONSE message contains all required fields including keyConfirmation
**Prerequisites:**

- KEP_INIT successfully sent and received
- Session keys derived
- Browser console access

**Detailed Steps:**

1. Bob receives KEP_INIT and processes it
2. Bob generates KEP_RESPONSE
3. Monitor `buildKEPResponse()` function execution
4. Verify KEP_RESPONSE message structure:
   - `type`: "KEP_RESPONSE" (exact string match)
   - `from`: Bob's userId (string)
   - `to`: Alice's userId (string)
   - `sessionId`: Same sessionId as KEP_INIT
   - `ephPub`: JWK object (Bob's ephemeral public key)
   - `signature`: Base64-encoded string
   - `keyConfirmation`: Base64-encoded HMAC (required field)
   - `timestamp`: Number (milliseconds)
   - `seq`: Number (should be 2 for KEP_RESPONSE)
   - `nonce`: Base64-encoded string
5. Verify keyConfirmation is present and non-empty
6. Verify seq is greater than KEP_INIT seq

**Expected Outcome:**

- KEP_RESPONSE contains all required fields
- keyConfirmation field present and valid
- seq equals 2 (increment from KEP_INIT)
- All fields properly formatted

**Evidence to Capture:**

- Complete KEP_RESPONSE message JSON
- keyConfirmation field value
- Sequence number verification

**Pass/Fail Criteria:**

- PASS: All required fields present, keyConfirmation included, seq = 2
- FAIL: Missing keyConfirmation, wrong seq, or missing fields

**PDF Requirements Validated:**

- KEP_RESPONSE message structure matches specification
- Required fields include keyConfirmation HMAC

---

## TC-ID: KEP-003

**Title:** KEP_INIT Missing Required Fields Rejection
**Objective:** Verify KEP_INIT validation rejects messages with missing required fields
**Prerequisites:**

- Test user with identity keys
- Ability to construct invalid KEP_INIT messages

**Detailed Steps:**

1. Create KEP_INIT message missing `type` field
2. Attempt validation via `validateKEPInit()`
3. Verify rejection with error: "Invalid message type"
4. Create KEP_INIT missing `from` field
5. Verify rejection with error: "Missing required fields"
6. Test each required field individually:
   - Missing `to`
   - Missing `ephPub`
   - Missing `signature`
   - Missing `sessionId`
   - Missing `timestamp`
   - Missing `seq`
   - Missing `nonce`
7. Verify all missing field cases are rejected

**Expected Outcome:**

- All missing field cases rejected
- Appropriate error messages returned
- Validation fails before signature verification
- Error logged to client logs

**Evidence to Capture:**

- Error messages for each missing field
- Validation function return values
- Client log entries

**Pass/Fail Criteria:**

- PASS: All missing field cases rejected with appropriate errors
- FAIL: Missing fields accepted or incorrect error messages

**PDF Requirements Validated:**

- KEP_INIT validation enforces required fields
- Missing fields cause rejection

---

## TC-ID: KEP-004

**Title:** KEP_RESPONSE Missing Required Fields Rejection
**Objective:** Verify KEP_RESPONSE validation rejects messages with missing required fields
**Prerequisites:**

- Test user with identity keys
- Ability to construct invalid KEP_RESPONSE messages

**Detailed Steps:**

1. Create KEP_RESPONSE message missing `type` field
2. Attempt validation via `validateKEPResponse()`
3. Verify rejection with error: "Invalid message type"
4. Create KEP_RESPONSE missing `keyConfirmation` field
5. Verify rejection with error: "Missing required fields"
6. Test each required field individually:
   - Missing `from`
   - Missing `ephPub`
   - Missing `signature`
   - Missing `keyConfirmation`
   - Missing `sessionId`
   - Missing `timestamp`
   - Missing `seq`
   - Missing `nonce`
7. Verify all missing field cases are rejected

**Expected Outcome:**

- All missing field cases rejected
- keyConfirmation absence specifically detected
- Appropriate error messages returned
- Error logged to client logs

**Evidence to Capture:**

- Error messages for each missing field
- Validation function return values
- Client log entries

**Pass/Fail Criteria:**

- PASS: All missing field cases rejected, keyConfirmation specifically checked
- FAIL: Missing fields accepted or keyConfirmation not validated

**PDF Requirements Validated:**

- KEP_RESPONSE validation enforces required fields
- keyConfirmation is required field

---

## TC-ID: KEP-005

**Title:** Ephemeral Key Generation - ECDH P-256 Verification
**Objective:** Verify ephemeral keys are generated using ECDH P-256 algorithm
**Prerequisites:**

- Test user ready to initiate key exchange
- Browser console access

**Detailed Steps:**

1. Initiate key exchange
2. Monitor `generateEphemeralKeyPair()` function
3. Verify key generation parameters:
   - Algorithm: `{name: 'ECDH', namedCurve: 'P-256'}`
   - Extractable: `true`
   - Usages: `['deriveKey', 'deriveBits']`
4. Verify both private and public keys generated
5. Verify keys are CryptoKey objects
6. Verify ephemeral keys are NOT stored in IndexedDB
7. Verify keys exist only in memory

**Expected Outcome:**

- Ephemeral keys generated with ECDH P-256
- Keys are extractable for export
- Keys have correct usages
- Keys not persisted to IndexedDB
- Keys exist only in memory

**Evidence to Capture:**

- Key generation parameters
- Verification that keys are not in IndexedDB
- Memory inspection showing temporary key variables

**Pass/Fail Criteria:**

- PASS: Keys generated with ECDH P-256, not persisted
- FAIL: Wrong algorithm, keys stored, or incorrect usages

**PDF Requirements Validated:**

- Ephemeral keys use ECDH P-256
- Ephemeral keys are memory-only

---

## TC-ID: KEP-006

**Title:** Ephemeral Key JWK Format in KEP_INIT
**Objective:** Verify ephemeral public key is exported to correct JWK format in KEP_INIT
**Prerequisites:**

- Test user initiating key exchange
- Browser console access

**Detailed Steps:**

1. Generate ephemeral key pair
2. Build KEP_INIT message
3. Inspect `ephPub` field in KEP_INIT message
4. Verify JWK structure:
   - `kty`: "EC" (exact match)
   - `crv`: "P-256" (exact match)
   - `x`: Base64-encoded string (32 bytes when decoded)
   - `y`: Base64-encoded string (32 bytes when decoded)
   - `d`: MUST NOT be present (private key component)
5. Verify base64 encoding is valid
6. Verify coordinates are correct length for P-256

**Expected Outcome:**

- ephPub is valid JWK format
- All required JWK fields present
- No private key component (d)
- Base64 encoding valid
- Coordinates correct length

**Evidence to Capture:**

- ephPub JWK structure
- Verification that 'd' field is absent
- Base64 validation

**Pass/Fail Criteria:**

- PASS: Valid JWK format, no private component, correct structure
- FAIL: Invalid JWK, private component present, or wrong format

**PDF Requirements Validated:**

- Ephemeral keys exported in JWK format
- JWK format: {kty: "EC", crv: "P-256", x: <base64>, y: <base64>}

---

## TC-ID: KEP-007

**Title:** Digital Signature Generation on Ephemeral Key
**Objective:** Verify ephemeral public keys are signed with identity private key using ECDSA-SHA256
**Prerequisites:**

- Test user with identity keys
- Browser console access

**Detailed Steps:**

1. Generate ephemeral key pair
2. Export ephemeral public key to JWK
3. Monitor `signEphemeralKey()` function
4. Verify signing process:
   - JWK serialized to string: `JSON.stringify(ephPubJWK)`
   - Signed with identity private key
   - Algorithm: `{name: 'ECDSA', hash: 'SHA-256'}`
   - Signature returned as ArrayBuffer
5. Verify signature is base64-encoded in KEP_INIT
6. Verify signature length is appropriate for ECDSA P-256 (64 bytes = 128 bits)
7. Verify signature is different for different ephemeral keys

**Expected Outcome:**

- Signature generated using ECDSA-SHA256
- Signature signs JSON.stringify(ephPubJWK)
- Signature base64-encoded in message
- Different keys produce different signatures
- Signature length correct for P-256

**Evidence to Capture:**

- Signature generation parameters
- Signature value (base64)
- Verification that different keys produce different signatures

**Pass/Fail Criteria:**

- PASS: Signatures generated correctly, different for different keys
- FAIL: Wrong algorithm, incorrect signing data, or identical signatures

**PDF Requirements Validated:**

- Ephemeral keys signed with identity private key
- Signature algorithm: ECDSA-SHA256

---

## TC-ID: KEP-008

**Title:** Signature Verification - Valid Signature Acceptance
**Objective:** Verify valid signatures on ephemeral keys are accepted
**Prerequisites:**

- Two test users with identity keys
- KEP_INIT message from Alice

**Detailed Steps:**

1. Alice generates KEP_INIT with signed ephemeral key
2. Bob receives KEP_INIT
3. Bob retrieves Alice's identity public key from server
4. Bob verifies signature using `verifyEphemeralKeySignature()`
5. Verify verification process:
   - Alice's identity public key imported
   - Signature decoded from base64
   - JWK serialized to string: `JSON.stringify(ephPubJWK)`
   - Verification algorithm: `{name: 'ECDSA', hash: 'SHA-256'}`
6. Verify signature verification returns `true`
7. Verify KEP_INIT validation succeeds

**Expected Outcome:**

- Valid signature verified successfully
- Verification returns true
- KEP_INIT validation passes
- Session establishment proceeds

**Evidence to Capture:**

- Signature verification result (true)
- KEP_INIT validation result
- Successful session establishment

**Pass/Fail Criteria:**

- PASS: Valid signature verified, KEP_INIT accepted
- FAIL: Valid signature rejected or verification fails

**PDF Requirements Validated:**

- Signature verification works for valid signatures
- Valid KEP_INIT messages accepted

---

## TC-ID: KEP-009

**Title:** Signature Verification - Invalid Signature Rejection
**Objective:** Verify invalid signatures on ephemeral keys are rejected
**Prerequisites:**

- Two test users with identity keys
- Ability to modify KEP messages

**Detailed Steps:**

1. Alice generates valid KEP_INIT
2. Modify signature in KEP_INIT:
   - Replace with random base64 string
   - Or corrupt signature bytes
3. Bob receives modified KEP_INIT
4. Bob attempts signature verification
5. Verify verification returns `false`
6. Verify KEP_INIT validation fails with error: "Invalid signature"
7. Verify error logged to `invalid_signature.log`
8. Verify session establishment does NOT proceed

**Expected Outcome:**

- Invalid signature rejected
- Verification returns false
- KEP_INIT validation fails
- Error logged appropriately
- Session not established

**Evidence to Capture:**

- Signature verification result (false)
- Validation error message
- Log entry in invalid_signature.log
- Confirmation session not established

**Pass/Fail Criteria:**

- PASS: Invalid signature rejected, logged, session not established
- FAIL: Invalid signature accepted or not logged

**PDF Requirements Validated:**

- Invalid signatures are rejected
- Signature failures are logged

---

## TC-ID: KEP-010

**Title:** Signature Verification - Wrong Identity Key Rejection
**Objective:** Verify signature verification fails when using wrong identity public key
**Prerequisites:**

- Three test users (Alice, Bob, Charlie) with identity keys
- KEP_INIT from Alice

**Detailed Steps:**

1. Alice generates KEP_INIT signed with Alice's identity key
2. Bob receives KEP_INIT
3. Bob attempts verification using Charlie's identity public key (wrong key)
4. Verify signature verification returns `false`
5. Verify KEP_INIT validation fails
6. Verify error logged
7. Test with completely unrelated identity key
8. Verify all wrong key cases fail

**Expected Outcome:**

- Wrong identity key causes verification failure
- Validation fails with "Invalid signature"
- Error logged appropriately
- Session not established

**Evidence to Capture:**

- Verification result (false) with wrong key
- Validation error
- Log entry

**Pass/Fail Criteria:**

- PASS: Wrong identity keys cause verification failure
- FAIL: Wrong keys accepted or incorrect error handling

**PDF Requirements Validated:**

- Signature verification requires correct identity public key
- Wrong keys are rejected

---

## TC-ID: KEP-011

**Title:** Timestamp Validation - Within ±2 Minute Window
**Objective:** Verify KEP messages with timestamps within ±2 minutes are accepted
**Prerequisites:**

- Test users with synchronized clocks
- Ability to control message timestamps

**Detailed Steps:**

1. Generate KEP_INIT with current timestamp
2. Verify timestamp validation:
   - `age = Date.now() - message.timestamp`
   - `Math.abs(age) <= 120000` (2 minutes)
3. Test edge cases:
   - Timestamp exactly 2 minutes ago (should pass)
   - Timestamp exactly 2 minutes in future (should pass)
   - Timestamp 1 minute ago (should pass)
   - Timestamp 1 minute in future (should pass)
4. Verify all valid timestamps accepted
5. Verify validation uses maxAge = 120000ms

**Expected Outcome:**

- Timestamps within ±2 minutes accepted
- Edge cases (exactly 2 minutes) handled correctly
- Validation uses 120000ms window

**Evidence to Capture:**

- Timestamp values tested
- Validation results for each case
- Verification of 120000ms window

**Pass/Fail Criteria:**

- PASS: All timestamps within ±2 minutes accepted
- FAIL: Valid timestamps rejected or wrong window size

**PDF Requirements Validated:**

- Timestamp validation uses ±2 minute window
- Window size: 120000ms (2 minutes)

---

## TC-ID: KEP-012

**Title:** Timestamp Validation - Stale Message Rejection (>2 minutes old)
**Objective:** Verify KEP messages older than 2 minutes are rejected
**Prerequisites:**

- Test user with ability to create messages with old timestamps

**Detailed Steps:**

1. Create KEP_INIT with timestamp = 3 minutes ago
2. Attempt validation
3. Verify rejection with error: "Timestamp out of validity window"
4. Test various stale timestamps:
   - 3 minutes ago
   - 5 minutes ago
   - 1 hour ago
   - 1 day ago
5. Verify all stale messages rejected
6. Verify error logged to `replay_attempts.log` (server) or client logs
7. Verify session establishment does NOT proceed

**Expected Outcome:**

- All stale messages (>2 minutes old) rejected
- Appropriate error message returned
- Error logged appropriately
- Session not established

**Evidence to Capture:**

- Timestamp values tested
- Rejection errors
- Log entries

**Pass/Fail Criteria:**

- PASS: All stale messages rejected and logged
- FAIL: Stale messages accepted or not logged

**PDF Requirements Validated:**

- Messages older than 2 minutes are rejected
- Stale messages logged as replay attempts

---

## TC-ID: KEP-013

**Title:** Timestamp Validation - Future Message Rejection (>2 minutes ahead)
**Objective:** Verify KEP messages from more than 2 minutes in future are rejected
**Prerequisites:**

- Test user with ability to create messages with future timestamps

**Detailed Steps:**

1. Create KEP_INIT with timestamp = 3 minutes in future
2. Attempt validation
3. Verify rejection with error: "Timestamp out of validity window"
4. Test various future timestamps:
   - 3 minutes in future
   - 5 minutes in future
   - 1 hour in future
   - 1 day in future
5. Verify all future messages rejected
6. Verify error logged
7. Verify session establishment does NOT proceed

**Expected Outcome:**

- All future messages (>2 minutes ahead) rejected
- Appropriate error message returned
- Error logged appropriately
- Session not established

**Evidence to Capture:**

- Timestamp values tested
- Rejection errors
- Log entries

**Pass/Fail Criteria:**

- PASS: All future messages rejected and logged
- FAIL: Future messages accepted or not logged

**PDF Requirements Validated:**

- Messages from future (>2 minutes) are rejected
- Future messages logged as replay attempts

---

## TC-ID: KEP-014

**Title:** Sequence Number - KEP_INIT Uses seq=1
**Objective:** Verify KEP_INIT messages use sequence number 1
**Prerequisites:**

- Test user initiating key exchange
- Browser console access

**Detailed Steps:**

1. Initiate new key exchange session
2. Generate KEP_INIT message
3. Verify `seq` field equals 1
4. Verify sequence manager assigns seq=1 for new session
5. Test multiple KEP_INIT attempts:
   - First KEP_INIT: seq = 1
   - If retry needed, verify sequence increments
6. Verify sequence number is integer
7. Verify sequence number is positive

**Expected Outcome:**

- KEP_INIT uses seq = 1
- Sequence manager correctly assigns initial sequence
- Sequence is integer and positive

**Evidence to Capture:**

- KEP_INIT message showing seq = 1
- Sequence manager state
- Multiple KEP_INIT attempts (if applicable)

**Pass/Fail Criteria:**

- PASS: KEP_INIT uses seq = 1
- FAIL: Wrong sequence number or non-integer

**PDF Requirements Validated:**

- KEP_INIT uses sequence number 1
- Sequence numbers are strictly increasing

---

## TC-ID: KEP-015

**Title:** Sequence Number - KEP_RESPONSE Uses seq=2
**Objective:** Verify KEP_RESPONSE messages use sequence number 2
**Prerequisites:**

- KEP_INIT successfully sent (seq=1)
- Test user ready to respond

**Detailed Steps:**

1. Bob receives KEP_INIT with seq=1
2. Bob generates KEP_RESPONSE
3. Verify `seq` field equals 2
4. Verify sequence manager increments from 1 to 2
5. Verify seq > KEP_INIT seq
6. Test sequence continuity:
   - KEP_INIT: seq = 1
   - KEP_RESPONSE: seq = 2
7. Verify sequence number is integer

**Expected Outcome:**

- KEP_RESPONSE uses seq = 2
- Sequence correctly incremented from KEP_INIT
- Sequence is strictly increasing

**Evidence to Capture:**

- KEP_RESPONSE message showing seq = 2
- Sequence manager state
- Verification of increment

**Pass/Fail Criteria:**

- PASS: KEP_RESPONSE uses seq = 2, correctly incremented
- FAIL: Wrong sequence number or not incremented

**PDF Requirements Validated:**

- KEP_RESPONSE uses sequence number 2
- Sequence numbers strictly increasing

---

## TC-ID: KEP-016

**Title:** Sequence Number - Non-Monotonic Sequence Rejection
**Objective:** Verify KEP messages with non-monotonic sequence numbers are rejected
**Prerequisites:**

- KEP_INIT with seq=1 already processed
- Ability to create messages with wrong sequence

**Detailed Steps:**

1. Process KEP_INIT with seq=1 (accepted)
2. Attempt to send KEP_RESPONSE with seq=1 (same as KEP_INIT)
3. Verify rejection: seq must be > lastSeq
4. Attempt KEP_RESPONSE with seq=0 (less than KEP_INIT)
5. Verify rejection
6. Test various invalid sequences:
   - seq = 1 (duplicate)
   - seq = 0 (decreasing)
   - seq = -1 (negative)
7. Verify all non-monotonic sequences rejected
8. Verify error logged

**Expected Outcome:**

- Non-monotonic sequences rejected
- Error message indicates sequence violation
- Error logged appropriately
- Session not established

**Evidence to Capture:**

- Invalid sequence values tested
- Rejection errors
- Log entries

**Pass/Fail Criteria:**

- PASS: All non-monotonic sequences rejected and logged
- FAIL: Non-monotonic sequences accepted

**PDF Requirements Validated:**

- Sequence numbers must be strictly increasing
- Non-monotonic sequences cause rejection

---

## TC-ID: KEP-017

**Title:** Nonce Presence and Format Validation
**Objective:** Verify nonce is present and correctly formatted in KEP messages
**Prerequisites:**

- Test user generating KEP messages
- Browser console access

**Detailed Steps:**

1. Generate KEP_INIT message
2. Verify `nonce` field is present
3. Verify nonce is base64-encoded string
4. Decode nonce from base64
5. Verify decoded nonce length:
   - Default: 16 bytes (128 bits)
   - Valid range: 12-32 bytes
6. Verify nonce is cryptographically random (not predictable)
7. Generate multiple KEP_INIT messages
8. Verify each nonce is unique
9. Repeat for KEP_RESPONSE

**Expected Outcome:**

- Nonce present in all KEP messages
- Nonce is base64-encoded string
- Decoded nonce is 16 bytes (or within 12-32 byte range)
- Nonces are unique per message
- Nonces appear random

**Evidence to Capture:**

- Nonce values from multiple messages
- Decoded nonce lengths
- Verification of uniqueness

**Pass/Fail Criteria:**

- PASS: Nonces present, correct format, unique, proper length
- FAIL: Missing nonce, wrong format, or duplicate nonces

**PDF Requirements Validated:**

- KEP messages include nonce field
- Nonce is 16 bytes (base64-encoded)
- Nonces are unique per message

---

## TC-ID: KEP-018

**Title:** Nonce Validation - Missing Nonce Rejection
**Objective:** Verify KEP messages without nonce are rejected
**Prerequisites:**

- Ability to create KEP messages without nonce
- Test user for validation

**Detailed Steps:**

1. Create KEP_INIT message without `nonce` field
2. Attempt validation
3. Verify rejection (if nonce validation implemented)
4. Create KEP_RESPONSE without nonce
5. Verify rejection
6. Test with null/undefined nonce
7. Verify all missing nonce cases handled

**Expected Outcome:**

- Missing nonce causes rejection (if validation implemented)
- Appropriate error message
- Error logged

**Evidence to Capture:**

- Error messages for missing nonce
- Validation results

**Pass/Fail Criteria:**

- PASS: Missing nonce rejected (if validation implemented)
- FAIL: Missing nonce accepted or not validated

**PDF Requirements Validated:**

- Nonce presence may be validated (implementation dependent)

---

## TC-ID: KEP-019

**Title:** Key Confirmation HMAC Generation
**Objective:** Verify key confirmation HMAC is generated correctly using rootKey
**Prerequisites:**

- KEP_INIT processed, shared secret computed
- RootKey derived via HKDF
- Test user ready to generate KEP_RESPONSE

**Detailed Steps:**

1. Bob derives rootKey from shared secret
2. Monitor key confirmation generation in `buildKEPResponse()`
3. Verify HMAC generation:
   - Data: `"CONFIRM:" + toUserId` (initiator's userId)
   - Key: rootKey (256 bits, ArrayBuffer)
   - Algorithm: HMAC-SHA256
   - Result: ArrayBuffer (256 bits)
4. Verify keyConfirmation is base64-encoded in KEP_RESPONSE
5. Verify HMAC length is 32 bytes (256 bits)
6. Verify same rootKey + same userId = same HMAC
7. Verify different rootKey or userId = different HMAC

**Expected Outcome:**

- Key confirmation HMAC generated using rootKey
- HMAC computed over "CONFIRM:" + userId
- HMAC is 256 bits (32 bytes)
- HMAC base64-encoded in message
- Deterministic for same inputs

**Evidence to Capture:**

- HMAC generation parameters
- KeyConfirmation value (base64)
- Verification of HMAC length

**Pass/Fail Criteria:**

- PASS: HMAC generated correctly, proper length, deterministic
- FAIL: Wrong HMAC computation, incorrect length, or non-deterministic

**PDF Requirements Validated:**

- Key confirmation: HMAC-SHA256(rootKey, "CONFIRM:" + userId)
- HMAC included in KEP_RESPONSE

---

## TC-ID: KEP-020

**Title:** Key Confirmation HMAC Verification
**Objective:** Verify key confirmation HMAC is verified correctly by initiator
**Prerequisites:**

- KEP_RESPONSE received with keyConfirmation
- RootKey derived by initiator
- Test user (Alice) ready to verify

**Detailed Steps:**

1. Alice receives KEP_RESPONSE with keyConfirmation
2. Alice has derived rootKey from shared secret
3. Monitor `validateKEPResponse()` key confirmation verification
4. Verify verification process:
   - Decode keyConfirmation from base64
   - Compute expected HMAC: `HMAC-SHA256(rootKey, "CONFIRM:" + aliceId)`
   - Compare received HMAC with computed HMAC
   - Use constant-time comparison (if implemented)
5. Verify verification returns `true` when HMACs match
6. Verify KEP_RESPONSE validation succeeds
7. Verify session establishment proceeds

**Expected Outcome:**

- Key confirmation HMAC verified correctly
- Verification succeeds when HMACs match
- KEP_RESPONSE validation passes
- Session established

**Evidence to Capture:**

- Verification result (true)
- KEP_RESPONSE validation result
- Successful session establishment

**Pass/Fail Criteria:**

- PASS: Valid key confirmation verified, session established
- FAIL: Valid confirmation rejected or verification fails

**PDF Requirements Validated:**

- Key confirmation HMAC verified by initiator
- Valid confirmation allows session establishment

---

## TC-ID: KEP-021

**Title:** Key Confirmation Failure - Mismatched HMAC Rejection
**Objective:** Verify KEP_RESPONSE with mismatched key confirmation is rejected
**Prerequisites:**

- KEP_RESPONSE message
- Ability to modify keyConfirmation

**Detailed Steps:**

1. Generate valid KEP_RESPONSE with correct keyConfirmation
2. Modify keyConfirmation:
   - Replace with random base64 string
   - Or corrupt HMAC bytes
3. Alice receives modified KEP_RESPONSE
4. Alice attempts key confirmation verification
5. Verify verification returns `false`
6. Verify KEP_RESPONSE validation fails with error: "Key confirmation failed"
7. Verify error logged
8. Verify session establishment does NOT proceed
9. Verify keys are discarded

**Expected Outcome:**

- Mismatched key confirmation rejected
- Verification returns false
- Validation fails with appropriate error
- Error logged
- Session not established
- Keys discarded

**Evidence to Capture:**

- Verification result (false)
- Validation error message
- Log entry
- Confirmation session not established

**Pass/Fail Criteria:**

- PASS: Mismatched confirmation rejected, logged, session not established
- FAIL: Mismatched confirmation accepted or not logged

**PDF Requirements Validated:**

- Key confirmation failures cause rejection
- Failed confirmations are logged

---

## TC-ID: KEP-022

**Title:** RootKey Derivation - HKDF Chain Verification
**Objective:** Verify rootKey is derived correctly using HKDF from shared secret
**Prerequisites:**

- Shared secret computed via ECDH
- Test user ready to derive keys

**Detailed Steps:**

1. Compute shared secret via ECDH (256 bits)
2. Monitor `deriveSessionKeys()` function
3. Verify rootKey derivation:
   - Input key material: sharedSecret (256 bits)
   - Salt: "ROOT" (encoded as bytes)
   - Info: sessionId (encoded as bytes)
   - Hash: SHA-256
   - Length: 256 bits
4. Verify HKDF algorithm parameters:
   - Algorithm: HKDF
   - Hash: SHA-256
5. Verify rootKey is 256 bits (32 bytes)
6. Verify same inputs produce same rootKey
7. Verify different sessionId produces different rootKey

**Expected Outcome:**

- RootKey derived using HKDF-SHA256
- Derivation uses correct salt ("ROOT") and info (sessionId)
- RootKey is 256 bits
- Deterministic for same inputs
- Different sessionIds produce different rootKeys

**Evidence to Capture:**

- HKDF parameters used
- RootKey value (hex or base64)
- Verification of length (32 bytes)

**Pass/Fail Criteria:**

- PASS: RootKey derived correctly, proper length, deterministic
- FAIL: Wrong derivation, incorrect length, or non-deterministic

**PDF Requirements Validated:**

- rootKey = HKDF(sharedSecret, "ROOT", sessionId, 256 bits)
- HKDF uses SHA-256

---

## TC-ID: KEP-023

**Title:** SendKey Derivation - HKDF Chain Verification
**Objective:** Verify sendKey is derived correctly from rootKey using HKDF
**Prerequisites:**

- RootKey derived
- Test user (Alice) ready to derive sendKey

**Detailed Steps:**

1. Alice has rootKey from HKDF derivation
2. Monitor sendKey derivation in `deriveSessionKeys()`
3. Verify sendKey derivation:
   - Input key material: rootKey (256 bits)
   - Salt: "SEND" (encoded as bytes)
   - Info: aliceId (Alice's userId, encoded as bytes)
   - Hash: SHA-256
   - Length: 256 bits
4. Verify sendKey is 256 bits (32 bytes)
5. Verify same rootKey + same userId = same sendKey
6. Verify different userId produces different sendKey
7. Verify Alice's sendKey matches Bob's recvKey (symmetry test)

**Expected Outcome:**

- SendKey derived using HKDF-SHA256 from rootKey
- Derivation uses salt "SEND" and info (userId)
- SendKey is 256 bits
- Deterministic for same inputs
- Symmetry: Alice's sendKey = Bob's recvKey

**Evidence to Capture:**

- HKDF parameters for sendKey
- SendKey value
- Verification of symmetry with peer's recvKey

**Pass/Fail Criteria:**

- PASS: SendKey derived correctly, proper length, symmetry verified
- FAIL: Wrong derivation, incorrect length, or symmetry broken

**PDF Requirements Validated:**

- sendKey = HKDF(rootKey, "SEND", userId, 256 bits)
- sendKey_A = recvKey_B (symmetry)

---

## TC-ID: KEP-024

**Title:** RecvKey Derivation - HKDF Chain Verification
**Objective:** Verify recvKey is derived correctly from rootKey using HKDF
**Prerequisites:**

- RootKey derived
- Test user (Alice) ready to derive recvKey

**Detailed Steps:**

1. Alice has rootKey from HKDF derivation
2. Monitor recvKey derivation in `deriveSessionKeys()`
3. Verify recvKey derivation:
   - Input key material: rootKey (256 bits)
   - Salt: "SEND" (encoded as bytes) - Note: uses "SEND" for symmetry
   - Info: peerId (Bob's userId, encoded as bytes)
   - Hash: SHA-256
   - Length: 256 bits
4. Verify recvKey is 256 bits (32 bytes)
5. Verify same rootKey + same peerId = same recvKey
6. Verify different peerId produces different recvKey
7. Verify Alice's recvKey matches Bob's sendKey (symmetry test)

**Expected Outcome:**

- RecvKey derived using HKDF-SHA256 from rootKey
- Derivation uses salt "SEND" and info (peerId) - Note: "SEND" salt ensures symmetry
- RecvKey is 256 bits
- Deterministic for same inputs
- Symmetry: Alice's recvKey = Bob's sendKey

**Evidence to Capture:**

- HKDF parameters for recvKey
- RecvKey value
- Verification of symmetry with peer's sendKey

**Pass/Fail Criteria:**

- PASS: RecvKey derived correctly, proper length, symmetry verified
- FAIL: Wrong derivation, incorrect length, or symmetry broken

**PDF Requirements Validated:**

- recvKey = HKDF(rootKey, "SEND", peerId, 256 bits)
- recvKey_A = sendKey_B (symmetry)
- Note: Uses "SEND" salt for symmetry

---

## TC-ID: KEP-025

**Title:** Session Key Symmetry Verification
**Objective:** Verify both parties derive identical send/recv keys
**Prerequisites:**

- Two test users (Alice and Bob)
- Successful key exchange

**Detailed Steps:**

1. Alice and Bob complete key exchange
2. Both derive session keys from same shared secret
3. Compare keys:
   - Alice's sendKey vs Bob's recvKey (should match)
   - Bob's sendKey vs Alice's recvKey (should match)
4. Verify key values are identical (byte-by-byte comparison)
5. Verify keys can be used for encryption/decryption:
   - Alice encrypts with sendKey
   - Bob decrypts with recvKey (should succeed)
   - Bob encrypts with sendKey
   - Alice decrypts with recvKey (should succeed)
6. Verify rootKeys are identical (both parties)

**Expected Outcome:**

- Alice's sendKey = Bob's recvKey
- Bob's sendKey = Alice's recvKey
- Both rootKeys are identical
- Keys work for encryption/decryption
- Symmetry maintained

**Evidence to Capture:**

- Key values from both parties (for comparison)
- Encryption/decryption test results
- Verification of symmetry

**Pass/Fail Criteria:**

- PASS: Keys are symmetric, encryption/decryption works
- FAIL: Keys don't match or encryption fails

**PDF Requirements Validated:**

- Session keys are symmetric between parties
- sendKey_A = recvKey_B, sendKey_B = recvKey_A

---

## TC-ID: KEP-026

**Title:** Session Establishment Success - Complete Flow
**Objective:** Verify successful session establishment through complete KEP flow
**Prerequisites:**

- Two authenticated test users (Alice and Bob)
- Both users have identity keys
- Both users online via WebSocket

**Detailed Steps:**

1. Alice initiates key exchange:
   - Generates ephemeral key pair
   - Signs ephemeral public key
   - Sends KEP_INIT to server
2. Server validates and forwards KEP_INIT to Bob
3. Bob receives KEP_INIT:
   - Verifies timestamp (±2 minutes)
   - Verifies signature using Alice's identity public key
   - Generates own ephemeral key pair
   - Computes shared secret via ECDH
   - Derives session keys via HKDF
   - Generates key confirmation HMAC
   - Sends KEP_RESPONSE
4. Server forwards KEP_RESPONSE to Alice
5. Alice receives KEP_RESPONSE:
   - Verifies timestamp
   - Verifies signature
   - Computes shared secret
   - Derives session keys
   - Verifies key confirmation
6. Verify session established:
   - Session keys stored in IndexedDB
   - Both parties can encrypt/decrypt messages
   - Session metadata correct

**Expected Outcome:**

- Complete KEP flow succeeds
- All validations pass
- Session keys derived and stored
- Both parties can communicate
- Session metadata correct

**Evidence to Capture:**

- KEP_INIT and KEP_RESPONSE messages
- Session establishment confirmation
- Stored session keys in IndexedDB
- Successful encrypted message exchange

**Pass/Fail Criteria:**

- PASS: Complete flow succeeds, session established, keys work
- FAIL: Flow fails at any step or keys don't work

**PDF Requirements Validated:**

- Complete KEP flow establishes secure session
- Session keys enable encrypted communication

---

## TC-ID: KEP-027

**Title:** Session Establishment Rejection - Invalid Signature
**Objective:** Verify session establishment fails when signature is invalid
**Prerequisites:**

- Two test users
- Ability to modify KEP messages

**Detailed Steps:**

1. Alice generates KEP_INIT
2. Modify signature in KEP_INIT (corrupt or replace)
3. Bob receives modified KEP_INIT
4. Bob attempts signature verification
5. Verify verification fails
6. Verify KEP_INIT validation fails
7. Verify error logged to `invalid_signature.log`
8. Verify Bob does NOT:
   - Generate ephemeral keys
   - Compute shared secret
   - Derive session keys
   - Send KEP_RESPONSE
9. Verify no session established

**Expected Outcome:**

- Invalid signature causes rejection
- KEP_INIT validation fails
- Error logged appropriately
- No session keys generated
- No KEP_RESPONSE sent
- Session not established

**Evidence to Capture:**

- Signature verification failure
- Validation error
- Log entry in invalid_signature.log
- Confirmation no session established

**Pass/Fail Criteria:**

- PASS: Invalid signature rejected, logged, no session established
- FAIL: Invalid signature accepted or session established

**PDF Requirements Validated:**

- Invalid signatures prevent session establishment
- Signature failures are logged

---

## TC-ID: KEP-028

**Title:** Session Establishment Rejection - Stale Timestamp
**Objective:** Verify session establishment fails when timestamp is stale
**Prerequisites:**

- Two test users
- Ability to create messages with old timestamps

**Detailed Steps:**

1. Create KEP_INIT with timestamp = 3 minutes ago
2. Bob receives stale KEP_INIT
3. Bob attempts timestamp validation
4. Verify validation fails: "Timestamp out of validity window"
5. Verify error logged to `replay_attempts.log` (server) or client logs
6. Verify Bob does NOT:
   - Verify signature (validation stops early)
   - Generate ephemeral keys
   - Send KEP_RESPONSE
7. Verify no session established
8. Test with various stale timestamps (5 min, 1 hour, 1 day)

**Expected Outcome:**

- Stale timestamp causes rejection
- Validation fails before signature check
- Error logged appropriately
- No session keys generated
- Session not established

**Evidence to Capture:**

- Timestamp validation failure
- Error message
- Log entries
- Confirmation no session established

**Pass/Fail Criteria:**

- PASS: Stale timestamps rejected, logged, no session established
- FAIL: Stale timestamps accepted or session established

**PDF Requirements Validated:**

- Stale timestamps prevent session establishment
- Timestamp failures are logged

---

## TC-ID: KEP-029

**Title:** Session Establishment Rejection - Key Confirmation Failure
**Objective:** Verify session establishment fails when key confirmation HMAC mismatches
**Prerequisites:**

- KEP_INIT successfully processed
- KEP_RESPONSE generated
- Ability to modify keyConfirmation

**Detailed Steps:**

1. Bob generates valid KEP_RESPONSE with correct keyConfirmation
2. Modify keyConfirmation in KEP_RESPONSE (corrupt or replace)
3. Alice receives modified KEP_RESPONSE
4. Alice verifies signature (should pass)
5. Alice attempts key confirmation verification
6. Verify verification fails: "Key confirmation failed"
7. Verify error logged
8. Verify Alice does NOT:
   - Store session keys
   - Establish session
9. Verify keys are discarded
10. Verify no session established

**Expected Outcome:**

- Key confirmation failure causes rejection
- KEP_RESPONSE validation fails
- Error logged appropriately
- Session keys not stored
- Keys discarded
- Session not established

**Evidence to Capture:**

- Key confirmation verification failure
- Validation error
- Log entry
- Confirmation no session established

**Pass/Fail Criteria:**

- PASS: Key confirmation failure rejected, logged, no session established
- FAIL: Key confirmation failure accepted or session established

**PDF Requirements Validated:**

- Key confirmation failures prevent session establishment
- Failed confirmations are logged

---

## TC-ID: KEP-030

**Title:** Invalid Signature Logging - KEP_INIT
**Objective:** Verify invalid signatures in KEP_INIT are logged to invalid_signature.log
**Prerequisites:**

- Test user receiving KEP_INIT
- Access to server logs
- Invalid signature scenario

**Detailed Steps:**

1. Create KEP_INIT with invalid signature
2. Bob receives and attempts validation
3. Verify signature verification fails
4. Check server logs: `server/logs/invalid_signature.log`
5. Verify log entry contains:
   - `eventType`: "INVALID_SIGNATURE"
   - `sessionId`: Session identifier
   - `userId`: Bob's userId (receiver)
   - `messageType`: "KEP_INIT"
   - `reason`: Error description
   - `action`: "REJECTED"
   - `timestamp`: Log timestamp
6. Verify log entry is HMAC-protected (if implemented)
7. Verify client-side logs (if applicable)

**Expected Outcome:**

- Invalid signature logged to invalid_signature.log
- Log entry contains all required fields
- Log entry is HMAC-protected (if implemented)
- Log entry is structured and parseable

**Evidence to Capture:**

- Log entry from invalid_signature.log
- Verification of log fields
- HMAC verification (if applicable)

**Pass/Fail Criteria:**

- PASS: Invalid signature logged with all required fields
- FAIL: Not logged, missing fields, or incorrect format

**PDF Requirements Validated:**

- Invalid signatures are logged
- Log format: invalid_signature.log

---

## TC-ID: KEP-031

**Title:** Invalid Signature Logging - KEP_RESPONSE
**Objective:** Verify invalid signatures in KEP_RESPONSE are logged to invalid_signature.log
**Prerequisites:**

- Test user receiving KEP_RESPONSE
- Access to server logs
- Invalid signature scenario

**Detailed Steps:**

1. Create KEP_RESPONSE with invalid signature
2. Alice receives and attempts validation
3. Verify signature verification fails
4. Check server logs: `server/logs/invalid_signature.log`
5. Verify log entry contains:
   - `eventType`: "INVALID_SIGNATURE"
   - `sessionId`: Session identifier
   - `userId`: Alice's userId (receiver)
   - `messageType`: "KEP_RESPONSE"
   - `reason`: Error description
   - `action`: "REJECTED"
   - `timestamp`: Log timestamp
6. Verify log entry is HMAC-protected (if implemented)
7. Verify client-side logs (if applicable)

**Expected Outcome:**

- Invalid signature logged to invalid_signature.log
- Log entry contains all required fields
- Log entry is HMAC-protected (if implemented)
- Log entry is structured and parseable

**Evidence to Capture:**

- Log entry from invalid_signature.log
- Verification of log fields
- HMAC verification (if applicable)

**Pass/Fail Criteria:**

- PASS: Invalid signature logged with all required fields
- FAIL: Not logged, missing fields, or incorrect format

**PDF Requirements Validated:**

- Invalid signatures are logged for KEP_RESPONSE
- Log format: invalid_signature.log

---

## TC-ID: KEP-032

**Title:** Timestamp Failure Logging - Stale KEP_INIT
**Objective:** Verify stale timestamp failures are logged to replay_attempts.log
**Prerequisites:**

- Test user receiving KEP_INIT
- Access to server logs
- Ability to create stale timestamp

**Detailed Steps:**

1. Create KEP_INIT with timestamp = 3 minutes ago (beyond ±2 minute window)
2. Bob receives KEP_INIT
3. Verify timestamp validation fails
4. Check server logs: `server/logs/replay_attempts.log`
5. Verify log entry contains:
   - `eventType`: "REPLAY_ATTEMPT"
   - `sessionId`: Session identifier
   - `userId`: Bob's userId (receiver)
   - `seq`: Sequence number from message
   - `timestamp`: Message timestamp
   - `reason`: "Timestamp out of validity window"
   - `action`: "REJECTED"
   - `ip`: Client IP (if available)
6. Verify client-side timestamp failure log (if applicable)
7. Verify log entry is HMAC-protected (if implemented)

**Expected Outcome:**

- Timestamp failure logged to replay_attempts.log
- Log entry contains all required fields
- Both server and client logs created (if applicable)
- Log entry is HMAC-protected (if implemented)

**Evidence to Capture:**

- Log entry from replay_attempts.log
- Client-side log entry (if applicable)
- Verification of log fields

**Pass/Fail Criteria:**

- PASS: Timestamp failure logged with all required fields
- FAIL: Not logged, missing fields, or incorrect format

**PDF Requirements Validated:**

- Timestamp failures are logged
- Log format: replay_attempts.log

---

## TC-ID: KEP-033

**Title:** Timestamp Failure Logging - Future KEP_RESPONSE
**Objective:** Verify future timestamp failures are logged to replay_attempts.log
**Prerequisites:**

- Test user receiving KEP_RESPONSE
- Access to server logs
- Ability to create future timestamp

**Detailed Steps:**

1. Create KEP_RESPONSE with timestamp = 3 minutes in future (beyond ±2 minute window)
2. Alice receives KEP_RESPONSE
3. Verify timestamp validation fails
4. Check server logs: `server/logs/replay_attempts.log`
5. Verify log entry contains:
   - `eventType`: "REPLAY_ATTEMPT"
   - `sessionId`: Session identifier
   - `userId`: Alice's userId (receiver)
   - `seq`: Sequence number from message
   - `timestamp`: Message timestamp (future value)
   - `reason`: "Timestamp out of validity window"
   - `action`: "REJECTED"
6. Verify client-side timestamp failure log (if applicable)
7. Verify log entry is HMAC-protected (if implemented)

**Expected Outcome:**

- Future timestamp failure logged to replay_attempts.log
- Log entry contains all required fields
- Both server and client logs created (if applicable)
- Log entry is HMAC-protected (if implemented)

**Evidence to Capture:**

- Log entry from replay_attempts.log
- Client-side log entry (if applicable)
- Verification of log fields

**Pass/Fail Criteria:**

- PASS: Future timestamp failure logged with all required fields
- FAIL: Not logged, missing fields, or incorrect format

**PDF Requirements Validated:**

- Future timestamp failures are logged
- Log format: replay_attempts.log

---

## TC-ID: KEP-034

**Title:** Sequence Number Failure Logging - Non-Monotonic KEP_INIT
**Objective:** Verify non-monotonic sequence number failures are logged
**Prerequisites:**

- Test user receiving KEP_INIT
- Access to server logs
- Previous KEP_INIT with seq=1 already processed

**Detailed Steps:**

1. Bob receives and processes KEP_INIT with seq=1
2. Create second KEP_INIT with seq=1 (duplicate) or seq=0 (decreasing)
3. Bob receives second KEP_INIT
4. Verify sequence validation fails
5. Check server logs: `server/logs/replay_attempts.log`
6. Verify log entry contains:
   - `eventType`: "REPLAY_ATTEMPT"
   - `sessionId`: Session identifier
   - `userId`: Bob's userId (receiver)
   - `seq`: Sequence number from message
   - `timestamp`: Message timestamp
   - `reason`: "Sequence number not monotonic" or similar
   - `action`: "REJECTED"
7. Verify client-side sequence failure log (if applicable)

**Expected Outcome:**

- Sequence number failure logged to replay_attempts.log
- Log entry contains all required fields
- Both server and client logs created (if applicable)
- Log entry is HMAC-protected (if implemented)

**Evidence to Capture:**

- Log entry from replay_attempts.log
- Client-side log entry (if applicable)
- Verification of log fields

**Pass/Fail Criteria:**

- PASS: Sequence failure logged with all required fields
- FAIL: Not logged, missing fields, or incorrect format

**PDF Requirements Validated:**

- Sequence number failures are logged
- Log format: replay_attempts.log

---

## TC-ID: KEP-035

**Title:** Sequence Number Failure Logging - Non-Monotonic KEP_RESPONSE
**Objective:** Verify non-monotonic sequence number failures in KEP_RESPONSE are logged
**Prerequisites:**

- Test user receiving KEP_RESPONSE
- Access to server logs
- Previous KEP_RESPONSE with seq=2 already processed

**Detailed Steps:**

1. Alice receives and processes KEP_RESPONSE with seq=2
2. Create second KEP_RESPONSE with seq=2 (duplicate) or seq=1 (decreasing)
3. Alice receives second KEP_RESPONSE
4. Verify sequence validation fails
5. Check server logs: `server/logs/replay_attempts.log`
6. Verify log entry contains:
   - `eventType`: "REPLAY_ATTEMPT"
   - `sessionId`: Session identifier
   - `userId`: Alice's userId (receiver)
   - `seq`: Sequence number from message
   - `timestamp`: Message timestamp
   - `reason`: "Sequence number not monotonic" or similar
   - `action`: "REJECTED"
7. Verify client-side sequence failure log (if applicable)

**Expected Outcome:**

- Sequence number failure logged to replay_attempts.log
- Log entry contains all required fields
- Both server and client logs created (if applicable)
- Log entry is HMAC-protected (if implemented)

**Evidence to Capture:**

- Log entry from replay_attempts.log
- Client-side log entry (if applicable)
- Verification of log fields

**Pass/Fail Criteria:**

- PASS: Sequence failure logged with all required fields
- FAIL: Not logged, missing fields, or incorrect format

**PDF Requirements Validated:**

- Sequence number failures are logged for KEP_RESPONSE
- Log format: replay_attempts.log

---

## TC-ID: KEP-036

**Title:** Key Exchange Attempt Logging - Successful KEP_INIT
**Objective:** Verify successful KEP_INIT attempts are logged to key_exchange_attempts.log
**Prerequisites:**

- Two authenticated test users
- Access to server logs
- Successful key exchange scenario

**Detailed Steps:**

1. Alice sends KEP_INIT to Bob
2. Server receives and processes KEP_INIT
3. Check server logs: `server/logs/key_exchange_attempts.log`
4. Verify log entry contains:
   - `eventType`: "KEY_EXCHANGE"
   - `sessionId`: Session identifier
   - `fromUserId`: Alice's userId
   - `toUserId`: Bob's userId
   - `messageType`: "KEP_INIT"
   - `success`: true
   - `action`: "ACCEPTED"
5. Verify log entry is structured and parseable
6. Verify no sensitive data in log (no private keys, no plaintext)

**Expected Outcome:**

- Successful KEP_INIT logged to key_exchange_attempts.log
- Log entry contains all required fields
- success field is true
- action field is "ACCEPTED"
- No sensitive data in log

**Evidence to Capture:**

- Log entry from key_exchange_attempts.log
- Verification of log fields
- Confirmation of no sensitive data

**Pass/Fail Criteria:**

- PASS: Successful KEP_INIT logged with all required fields, no sensitive data
- FAIL: Not logged, missing fields, or sensitive data present

**PDF Requirements Validated:**

- Key exchange attempts are logged
- Log format: key_exchange_attempts.log

---

## TC-ID: KEP-037

**Title:** Key Exchange Attempt Logging - Successful KEP_RESPONSE
**Objective:** Verify successful KEP_RESPONSE attempts are logged to key_exchange_attempts.log
**Prerequisites:**

- Two authenticated test users
- Access to server logs
- Successful key exchange scenario

**Detailed Steps:**

1. Bob sends KEP_RESPONSE to Alice
2. Server receives and processes KEP_RESPONSE
3. Check server logs: `server/logs/key_exchange_attempts.log`
4. Verify log entry contains:
   - `eventType`: "KEY_EXCHANGE"
   - `sessionId`: Session identifier
   - `fromUserId`: Bob's userId
   - `toUserId`: Alice's userId
   - `messageType`: "KEP_RESPONSE"
   - `success`: true
   - `action`: "ACCEPTED"
5. Verify log entry is structured and parseable
6. Verify no sensitive data in log (no private keys, no plaintext, no session keys)

**Expected Outcome:**

- Successful KEP_RESPONSE logged to key_exchange_attempts.log
- Log entry contains all required fields
- success field is true
- action field is "ACCEPTED"
- No sensitive data in log

**Evidence to Capture:**

- Log entry from key_exchange_attempts.log
- Verification of log fields
- Confirmation of no sensitive data

**Pass/Fail Criteria:**

- PASS: Successful KEP_RESPONSE logged with all required fields, no sensitive data
- FAIL: Not logged, missing fields, or sensitive data present

**PDF Requirements Validated:**

- Key exchange attempts are logged
- Log format: key_exchange_attempts.log

---

## TC-ID: KEP-038

**Title:** Key Exchange Attempt Logging - Failed KEP_INIT
**Objective:** Verify failed KEP_INIT attempts are logged to key_exchange_attempts.log
**Prerequisites:**

- Two authenticated test users
- Access to server logs
- Failed key exchange scenario (invalid signature)

**Detailed Steps:**

1. Alice sends KEP_INIT with invalid signature to Bob
2. Bob receives and validates KEP_INIT
3. Verify validation fails (invalid signature)
4. Check server logs: `server/logs/key_exchange_attempts.log`
5. Verify log entry contains:
   - `eventType`: "KEY_EXCHANGE"
   - `sessionId`: Session identifier
   - `fromUserId`: Alice's userId
   - `toUserId`: Bob's userId
   - `messageType`: "KEP_INIT"
   - `success`: false
   - `action`: "REJECTED"
6. Verify log entry is structured and parseable
7. Verify no sensitive data in log

**Expected Outcome:**

- Failed KEP_INIT logged to key_exchange_attempts.log
- Log entry contains all required fields
- success field is false
- action field is "REJECTED"
- No sensitive data in log

**Evidence to Capture:**

- Log entry from key_exchange_attempts.log
- Verification of log fields
- Confirmation of no sensitive data

**Pass/Fail Criteria:**

- PASS: Failed KEP_INIT logged with all required fields, no sensitive data
- FAIL: Not logged, missing fields, or sensitive data present

**PDF Requirements Validated:**

- Failed key exchange attempts are logged
- Log format: key_exchange_attempts.log

---

## TC-ID: KEP-039

**Title:** Key Exchange Attempt Logging - Failed KEP_RESPONSE
**Objective:** Verify failed KEP_RESPONSE attempts are logged to key_exchange_attempts.log
**Prerequisites:**

- Two authenticated test users
- Access to server logs
- Failed key exchange scenario (key confirmation failure)

**Detailed Steps:**

1. Bob sends KEP_RESPONSE with invalid keyConfirmation to Alice
2. Alice receives and validates KEP_RESPONSE
3. Verify validation fails (key confirmation failure)
4. Check server logs: `server/logs/key_exchange_attempts.log`
5. Verify log entry contains:
   - `eventType`: "KEY_EXCHANGE"
   - `sessionId`: Session identifier
   - `fromUserId`: Bob's userId
   - `toUserId`: Alice's userId
   - `messageType`: "KEP_RESPONSE"
   - `success`: false
   - `action`: "REJECTED"
6. Verify log entry is structured and parseable
7. Verify no sensitive data in log

**Expected Outcome:**

- Failed KEP_RESPONSE logged to key_exchange_attempts.log
- Log entry contains all required fields
- success field is false
- action field is "REJECTED"
- No sensitive data in log

**Evidence to Capture:**

- Log entry from key_exchange_attempts.log
- Verification of log fields
- Confirmation of no sensitive data

**Pass/Fail Criteria:**

- PASS: Failed KEP_RESPONSE logged with all required fields, no sensitive data
- FAIL: Not logged, missing fields, or sensitive data present

**PDF Requirements Validated:**

- Failed key exchange attempts are logged
- Log format: key_exchange_attempts.log

---

## TC-ID: KEP-040

**Title:** Invalid KEP Message Logging - Missing Required Fields
**Objective:** Verify KEP messages with missing required fields are logged to invalid_kep_message.log
**Prerequisites:**

- Test user sending KEP message
- Access to server logs
- Ability to create malformed KEP message

**Detailed Steps:**

1. Create KEP_INIT message missing required field (e.g., missing signature)
2. Send to server via WebSocket or REST API
3. Server receives and validates message
4. Verify validation fails: "Missing required fields"
5. Check server logs: `server/logs/invalid_kep_message.log`
6. Verify log entry contains:
   - `eventType`: "INVALID_KEP_MESSAGE"
   - `type`: "invalid_kep_message"
   - `sessionId`: Session identifier (if available)
   - `userId`: Sender's userId
   - `reason`: "Missing required fields" or specific field name
   - `action`: "REJECTED"
7. Verify log entry is structured and parseable
8. Verify no sensitive data in log

**Expected Outcome:**

- Invalid KEP message logged to invalid_kep_message.log
- Log entry contains all required fields
- reason field indicates missing field
- action field is "REJECTED"
- No sensitive data in log

**Evidence to Capture:**

- Log entry from invalid_kep_message.log
- Verification of log fields
- Confirmation of no sensitive data

**Pass/Fail Criteria:**

- PASS: Invalid KEP message logged with all required fields, no sensitive data
- FAIL: Not logged, missing fields, or sensitive data present

**PDF Requirements Validated:**

- Invalid KEP messages are logged
- Log format: invalid_kep_message.log

---

**End of Key Exchange Protocol Testcase Suite**
