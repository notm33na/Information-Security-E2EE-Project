# MITM Attack Testcase Suite

## TC-ID: MITM-001

**Title:** Unsigned ECDH Variant - MITM Intercepts KEP_INIT
**Objective:** Verify MITM can intercept KEP_INIT in unsigned ECDH variant
**Prerequisites:**

- Two authenticated users (Alice and Bob)
- Unsigned ECDH mode enabled 
- MITM simulator access

**Detailed Steps:**

1. Alice initiates key exchange with Bob
2. Alice generates KEP_INIT with ephemeral public key (no signature)
3. Monitor network traffic (WebSocket)
4. Verify MITM interception:
   - Attacker intercepts KEP_INIT message
   - KEP_INIT contains `ephPub` (Alice's ephemeral public key)
   - KEP_INIT does NOT contain `signature` field (unsigned variant)
5. Verify attacker can read ephemeral key:
   - Attacker extracts `ephPub` from KEP_INIT
   - Attacker can parse JWK format
   - Attacker has Alice's ephemeral public key

**Expected Outcome:**

- MITM successfully intercepts KEP_INIT
- Ephemeral key extracted by attacker
- No signature present to prevent modification
- Attacker can read Alice's ephemeral public key

**Evidence to Capture:**

- Intercepted KEP_INIT message
- Extracted ephemeral key
- Confirmation no signature field
- Network traffic capture

**Pass/Fail Criteria:**

- PASS: MITM intercepts KEP_INIT, extracts ephemeral key, no signature
- FAIL: Interception fails or signature present

**PDF Requirements Validated:**

- Unsigned ECDH variant vulnerability
- MITM interception capability

---

## TC-ID: MITM-002

**Title:** Unsigned ECDH Variant - MITM Replaces Ephemeral Key
**Objective:** Verify MITM can replace ephemeral key in unsigned ECDH variant
**Prerequisites:**

- MITM intercepted KEP_INIT
- Attacker has generated own ephemeral key pair
- Unsigned ECDH mode enabled

**Detailed Steps:**

1. Attacker intercepts KEP_INIT with Alice's ephemeral key
2. Attacker generates own ephemeral key pair:
   - `attackerKeyPair = generateEphemeralKeyPair()`
   - `attackerEphPub = exportPublicKey(attackerKeyPair.publicKey)`
3. Attacker replaces ephemeral key:
   - Original KEP_INIT: `ephPub = aliceEphPub`
   - Modified KEP_INIT: `ephPub = attackerEphPub`
4. Verify key replacement:
   - Modified KEP_INIT contains attacker's ephemeral key
   - Original Alice's key removed
   - No signature to detect modification
5. Verify modified message structure:
   - All other fields unchanged (sessionId, from, to, timestamp, seq, nonce)
   - Only `ephPub` field modified

**Expected Outcome:**

- MITM successfully replaces ephemeral key
- Modified KEP_INIT contains attacker's key
- No signature verification to detect tampering
- Message structure remains valid

**Evidence to Capture:**

- Original KEP_INIT
- Modified KEP_INIT
- Attacker's ephemeral key
- Key replacement confirmation

**Pass/Fail Criteria:**

- PASS: Key replaced successfully, no detection mechanism
- FAIL: Key replacement fails or detected

**PDF Requirements Validated:**

- Unsigned ECDH variant vulnerability
- Key substitution attack

---

## TC-ID: MITM-003

**Title:** Unsigned ECDH Variant - MITM Forwards Modified KEP_INIT to Bob
**Objective:** Verify MITM can forward modified KEP_INIT to Bob without detection
**Prerequisites:**

- MITM replaced ephemeral key in KEP_INIT
- Bob's WebSocket connection
- Unsigned ECDH mode enabled

**Detailed Steps:**

1. Attacker has modified KEP_INIT with attacker's ephemeral key
2. Attacker forwards modified KEP_INIT to Bob:
   - Send via WebSocket: `socket.emit('kep:init', modifiedKEP_INIT)`
   - Or inject into network traffic
3. Bob receives modified KEP_INIT
4. Verify Bob accepts modified message:
   - Bob receives KEP_INIT
   - Bob extracts `ephPub` (attacker's key, not Alice's)
   - Bob does NOT verify signature (no signature field)
   - Bob proceeds with key exchange
5. Verify no detection:
   - No signature verification failure
   - No error logged
   - Bob treats message as legitimate

**Expected Outcome:**

- Modified KEP_INIT forwarded to Bob
- Bob accepts message without verification
- No signature check to detect tampering
- Bob proceeds with key exchange

**Evidence to Capture:**

- Forwarded KEP_INIT
- Bob's acceptance
- No error logs
- Key exchange continuation

**Pass/Fail Criteria:**

- PASS: Modified message forwarded and accepted, no detection
- FAIL: Message rejected or tampering detected

**PDF Requirements Validated:**

- Unsigned ECDH variant vulnerability
- Successful key substitution

---

## TC-ID: MITM-004

**Title:** Unsigned ECDH Variant - MITM Intercepts KEP_RESPONSE
**Objective:** Verify MITM can intercept KEP_RESPONSE in unsigned ECDH variant
**Prerequisites:**

- Bob received modified KEP_INIT
- Bob generates KEP_RESPONSE
- Unsigned ECDH mode enabled

**Detailed Steps:**

1. Bob receives modified KEP_INIT (with attacker's ephemeral key)
2. Bob generates KEP_RESPONSE with Bob's ephemeral public key (no signature)
3. Monitor network traffic
4. Verify MITM interception:
   - Attacker intercepts KEP_RESPONSE message
   - KEP_RESPONSE contains `ephPub` (Bob's ephemeral public key)
   - KEP_RESPONSE does NOT contain `signature` field (unsigned variant)
   - KEP_RESPONSE may contain `keyConfirmation` (but not verified in unsigned mode)
5. Verify attacker can read ephemeral key:
   - Attacker extracts `ephPub` from KEP_RESPONSE
   - Attacker can parse JWK format
   - Attacker has Bob's ephemeral public key

**Expected Outcome:**

- MITM successfully intercepts KEP_RESPONSE
- Ephemeral key extracted by attacker
- No signature present to prevent modification
- Attacker can read Bob's ephemeral public key

**Evidence to Capture:**

- Intercepted KEP_RESPONSE message
- Extracted ephemeral key
- Confirmation no signature field
- Network traffic capture

**Pass/Fail Criteria:**

- PASS: MITM intercepts KEP_RESPONSE, extracts ephemeral key, no signature
- FAIL: Interception fails or signature present

**PDF Requirements Validated:**

- Unsigned ECDH variant vulnerability
- KEP_RESPONSE interception

---

## TC-ID: MITM-005

**Title:** Unsigned ECDH Variant - MITM Derives Two Shared Secrets
**Objective:** Verify MITM can derive separate shared secrets with Alice and Bob
**Prerequisites:**

- MITM intercepted both KEP_INIT and KEP_RESPONSE
- Attacker has own ephemeral key pair
- Unsigned ECDH mode enabled

**Detailed Steps:**

1. Attacker has:
   - Alice's original ephemeral public key (from intercepted KEP_INIT)
   - Bob's ephemeral public key (from intercepted KEP_RESPONSE)
   - Attacker's own ephemeral key pair
2. Attacker computes shared secret with Bob:
   - `bobSharedSecret = ECDH(attackerPrivateKey, bobEphPub)`
   - Attacker uses own private key + Bob's public key
3. Attacker computes shared secret with Alice:
   - `aliceSharedSecret = ECDH(attackerPrivateKey, aliceEphPub)`
   - Attacker uses own private key + Alice's original public key
4. Verify both secrets computed:
   - `bobSharedSecret` is valid ArrayBuffer
   - `aliceSharedSecret` is valid ArrayBuffer
   - Both secrets are different (different public keys)
5. Verify attacker can derive session keys:
   - `rootKey_Bob = HKDF(bobSharedSecret, "ROOT", sessionId, 256)`
   - `rootKey_Alice = HKDF(aliceSharedSecret, "ROOT", sessionId, 256)`
   - Both rootKeys derived successfully

**Expected Outcome:**

- MITM derives two separate shared secrets
- One secret with Bob, one with Alice
- Both secrets valid and different
- Attacker can derive session keys for both

**Evidence to Capture:**

- Computed shared secrets
- Derived rootKeys
- Secret values (for verification)
- Session key derivation

**Pass/Fail Criteria:**

- PASS: Two shared secrets derived, session keys computed
- FAIL: Secret derivation fails

**PDF Requirements Validated:**

- Unsigned ECDH variant vulnerability
- Split session attack

---

## TC-ID: MITM-006

**Title:** Unsigned ECDH Variant - Successful MITM Confirmation
**Objective:** Verify MITM attack succeeds in unsigned ECDH variant
**Prerequisites:**

- MITM derived two shared secrets
- Attacker has session keys for both Alice and Bob
- Unsigned ECDH mode enabled

**Detailed Steps:**

1. Attacker has:
   - `rootKey_Bob` (derived from Bob's shared secret)
   - `rootKey_Alice` (derived from Alice's shared secret)
   - `sendKey_Bob`, `recvKey_Bob` (for Bob's session)
   - `sendKey_Alice`, `recvKey_Alice` (for Alice's session)
2. Verify attacker can decrypt messages:
   - Alice sends message encrypted with `sendKey_Alice`
   - Attacker intercepts message
   - Attacker decrypts using `recvKey_Alice` (derived from Alice's rootKey)
   - Attacker reads plaintext
3. Verify attacker can re-encrypt and forward:
   - Attacker re-encrypts with `sendKey_Bob` (derived from Bob's rootKey)
   - Attacker forwards to Bob
   - Bob receives and decrypts successfully
4. Verify attack success:
   - Attacker can read all messages
   - Alice and Bob unaware of MITM
   - Communication appears normal to users

**Expected Outcome:**

- MITM attack succeeds
- Attacker can decrypt all messages
- Attacker can read plaintext
- Alice and Bob unaware of attack

**Evidence to Capture:**

- Decrypted messages by attacker
- Re-encrypted and forwarded messages
- Attack success confirmation
- User unawareness

**Pass/Fail Criteria:**

- PASS: MITM succeeds, attacker can decrypt, users unaware
- FAIL: Attack fails or detected

**PDF Requirements Validated:**

- Unsigned ECDH variant vulnerability
- Successful MITM attack

---

## TC-ID: MITM-007

**Title:** Signed ECDH Variant - Substituting Ephemeral Keys Produces Invalid Signatures
**Objective:** Verify substituting ephemeral keys in signed ECDH produces invalid signatures
**Prerequisites:**

- Two authenticated users with identity keys
- Signed ECDH mode enabled
- MITM simulator access

**Detailed Steps:**

1. Alice generates KEP_INIT:
   - Generates ephemeral key pair: `EK_priv_A`, `EK_pub_A`
   - Signs ephemeral key: `signature = ECDSA(IK_priv_A, EK_pub_A_JWK)`
   - KEP_INIT contains: `ephPub = EK_pub_A`, `signature = signature`
2. Attacker intercepts KEP_INIT
3. Attacker attempts key substitution:
   - Generates attacker ephemeral key: `attackerEphPub`
   - Replaces `ephPub` in KEP_INIT: `ephPub = attackerEphPub`
   - Keeps original `signature` (signed with Alice's identity key)
4. Bob receives modified KEP_INIT
5. Bob attempts signature verification:
   - Fetches Alice's identity public key: `IK_pub_A`
   - Reconstructs payload: `JSON.stringify(attackerEphPub)`
   - Verifies signature: `verifySignature(IK_pub_A, signature, attackerEphPub)`
6. Verify signature verification fails:
   - Verification returns `false`
   - Signature does not match modified key
   - Error: "Invalid signature"

**Expected Outcome:**

- Key substitution produces invalid signature
- Signature verification fails
- Modified KEP_INIT rejected
- Error logged

**Evidence to Capture:**

- Original KEP_INIT
- Modified KEP_INIT
- Signature verification result (false)
- Error message

**Pass/Fail Criteria:**

- PASS: Signature invalid, verification fails, message rejected
- FAIL: Signature valid or verification passes

**PDF Requirements Validated:**

- Signed ECDH variant protection
- Signature verification prevents key substitution

---

## TC-ID: MITM-008

**Title:** Signed ECDH Variant - Tampering Causes Signature Verification Failure
**Objective:** Verify any tampering with signed ephemeral key causes signature verification failure
**Prerequisites:**

- Two authenticated users with identity keys
- Signed ECDH mode enabled
- KEP_INIT with valid signature

**Detailed Steps:**

1. Alice generates valid KEP_INIT with signature
2. Attacker intercepts KEP_INIT
3. Test tampering scenarios:
   - **Scenario A**: Modify `ephPub` JWK (change x or y coordinate)
   - **Scenario B**: Corrupt signature bytes
   - **Scenario C**: Replace `ephPub` with attacker's key
   - **Scenario D**: Modify other fields (sessionId, timestamp)
4. For each scenario, verify signature verification:
   - Bob receives tampered KEP_INIT
   - Bob verifies signature
   - Verification fails for all scenarios
5. Verify rejection:
   - All tampered messages rejected
   - Error: "Invalid signature"
   - No session established

**Expected Outcome:**

- All tampering scenarios cause signature verification failure
- Tampered messages rejected
- Errors logged
- No session established

**Evidence to Capture:**

- Tampered KEP_INIT messages
- Signature verification results (all false)
- Error messages
- Rejection confirmations

**Pass/Fail Criteria:**

- PASS: All tampering scenarios fail signature verification
- FAIL: Any tampered message passes verification

**PDF Requirements Validated:**

- Signed ECDH variant protection
- Signature verification detects tampering

---

## TC-ID: MITM-009

**Title:** Signed ECDH Variant - Key Confirmation Mismatch Detection
**Objective:** Verify key confirmation mismatch is detected and prevents session establishment
**Prerequisites:**

- Two authenticated users with identity keys
- Signed ECDH mode enabled
- KEP_RESPONSE with key confirmation

**Detailed Steps:**

1. Alice and Bob establish session (normal flow):
   - Alice sends KEP_INIT, Bob verifies signature
   - Bob sends KEP_RESPONSE with key confirmation
   - Both derive same `rootKey`
2. Attacker attempts MITM:
   - Attacker intercepts and modifies keys (but signatures fail, so this is theoretical)
   - Or: Attacker somehow causes different rootKey derivation
3. Verify key confirmation check:
   - Bob computes: `keyConfirmation = HMAC(rootKey_Bob, "CONFIRM:" + aliceId)`
   - Alice receives KEP_RESPONSE
   - Alice computes: `keyConfirmation_expected = HMAC(rootKey_Alice, "CONFIRM:" + aliceId)`
   - Alice compares: `keyConfirmation == keyConfirmation_expected`
4. If rootKeys differ:
   - `keyConfirmation != keyConfirmation_expected`
   - Key confirmation verification fails
   - Error: "Key confirmation failed"
5. Verify session rejection:
   - Session not established
   - Keys discarded
   - Error logged

**Expected Outcome:**

- Key confirmation mismatch detected
- Verification fails
- Session rejected
- Error logged

**Evidence to Capture:**

- Key confirmation values (computed vs received)
- Verification result (false)
- Error message
- Session rejection

**Pass/Fail Criteria:**

- PASS: Key confirmation mismatch detected, session rejected
- FAIL: Mismatch not detected or session established

**PDF Requirements Validated:**

- Signed ECDH variant protection
- Key confirmation prevents MITM

---

## TC-ID: MITM-010

**Title:** Signed ECDH Variant - Session Rejected on Invalid Signature
**Objective:** Verify session is rejected when signature verification fails
**Prerequisites:**

- Two authenticated users with identity keys
- Signed ECDH mode enabled
- Invalid signature in KEP_INIT or KEP_RESPONSE

**Detailed Steps:**

1. Alice sends KEP_INIT with invalid signature (or attacker modifies it)
2. Bob receives KEP_INIT
3. Bob verifies signature:
   - Signature verification fails
   - `validateKEPInit()` returns `{ valid: false, error: "Invalid signature" }`
4. Verify session rejection:
   - Session establishment stops
   - No session keys derived
   - No session stored in IndexedDB
   - Error returned to caller
5. Verify keys not stored:
   - No rootKey stored
   - No sendKey/recvKey stored
   - No session record created
6. Verify user notification:
   - Error message displayed (if UI handles it)
   - User informed of key exchange failure

**Expected Outcome:**

- Session rejected on invalid signature
- No session keys derived or stored
- Error logged and returned
- User notified of failure

**Evidence to Capture:**

- Signature verification failure
- Session rejection
- No session keys stored
- Error message

**Pass/Fail Criteria:**

- PASS: Session rejected, no keys stored, error logged
- FAIL: Session established or keys stored

**PDF Requirements Validated:**

- Signed ECDH variant protection
- Session rejection on signature failure

---

## TC-ID: MITM-011

**Title:** Logs Show Invalid Signature Attacks - KEP_INIT
**Objective:** Verify invalid signature attacks on KEP_INIT are logged
**Prerequisites:**

- Two authenticated users with identity keys
- Signed ECDH mode enabled
- Invalid signature in KEP_INIT
- Access to server logs

**Detailed Steps:**

1. Alice sends KEP_INIT with invalid signature (or attacker modifies it)
2. Bob receives and validates KEP_INIT
3. Signature verification fails
4. Check server logs: `server/logs/invalid_signature.log`
5. Verify log entry exists:
   - Log file exists
   - Entry for invalid signature present
6. Verify log entry structure:
   - `eventType`: "INVALID_SIGNATURE"
   - `sessionId`: Session identifier
   - `userId`: Bob's userId (receiver)
   - `messageType`: "KEP_INIT"
   - `reason`: "Invalid signature" or specific error
   - `action`: "REJECTED"
   - `timestamp`: Log timestamp
7. Verify log entry is HMAC-protected (if implemented)

**Expected Outcome:**

- Invalid signature logged to invalid_signature.log
- Log entry contains all required fields
- Log entry is HMAC-protected (if implemented)
- Log entry is structured and parseable

**Evidence to Capture:**

- Log entry from invalid_signature.log
- Field verification
- HMAC verification (if applicable)

**Pass/Fail Criteria:**

- PASS: Invalid signature logged with all required fields
- FAIL: Not logged or missing fields

**PDF Requirements Validated:**

- Logs show invalid signature attacks
- KEP_INIT signature failure logging

---

## TC-ID: MITM-012

**Title:** Logs Show Invalid Signature Attacks - KEP_RESPONSE
**Objective:** Verify invalid signature attacks on KEP_RESPONSE are logged
**Prerequisites:**

- Two authenticated users with identity keys
- Signed ECDH mode enabled
- Invalid signature in KEP_RESPONSE
- Access to server logs

**Detailed Steps:**

1. Bob sends KEP_RESPONSE with invalid signature (or attacker modifies it)
2. Alice receives and validates KEP_RESPONSE
3. Signature verification fails
4. Check server logs: `server/logs/invalid_signature.log`
5. Verify log entry exists:
   - Log file exists
   - Entry for invalid signature present
6. Verify log entry structure:
   - `eventType`: "INVALID_SIGNATURE"
   - `sessionId`: Session identifier
   - `userId`: Alice's userId (receiver)
   - `messageType`: "KEP_RESPONSE"
   - `reason`: "Invalid signature" or specific error
   - `action`: "REJECTED"
   - `timestamp`: Log timestamp
7. Verify log entry is HMAC-protected (if implemented)

**Expected Outcome:**

- Invalid signature logged to invalid_signature.log
- Log entry contains all required fields
- Log entry is HMAC-protected (if implemented)
- Log entry is structured and parseable

**Evidence to Capture:**

- Log entry from invalid_signature.log
- Field verification
- HMAC verification (if applicable)

**Pass/Fail Criteria:**

- PASS: Invalid signature logged with all required fields
- FAIL: Not logged or missing fields

**PDF Requirements Validated:**

- Logs show invalid signature attacks
- KEP_RESPONSE signature failure logging

---

## TC-ID: MITM-013

**Title:** Client UI Behavior - Key Exchange Failure Display
**Objective:** Verify client UI displays appropriate error when key exchange fails
**Prerequisites:**

- Two authenticated users
- Signed ECDH mode enabled
- Invalid signature causes key exchange failure
- Browser UI access

**Detailed Steps:**

1. Alice initiates key exchange with Bob
2. Invalid signature causes validation failure
3. Monitor client UI:
   - Check for error message display
   - Check for error notification/banner
   - Check console for error logs
4. Verify error display:
   - User-friendly error message shown
   - Error indicates key exchange failure
   - Error suggests retry or contact support
5. Verify UI state:
   - Session not established
   - Chat interface shows error state
   - User cannot send messages
   - Retry option available (if implemented)

**Expected Outcome:**

- Error message displayed to user
- User-friendly error text
- UI reflects error state
- User informed of failure

**Evidence to Capture:**

- UI screenshot with error message
- Error message text
- UI state verification
- Console error logs

**Pass/Fail Criteria:**

- PASS: Error displayed, user informed, UI reflects error state
- FAIL: No error displayed or user not informed

**PDF Requirements Validated:**

- Client UI behavior
- Key exchange failure handling

---

## TC-ID: MITM-014

**Title:** Client UI Behavior - Session Establishment Success
**Objective:** Verify client UI reflects successful session establishment
**Prerequisites:**

- Two authenticated users
- Signed ECDH mode enabled
- Valid key exchange
- Browser UI access

**Detailed Steps:**

1. Alice initiates key exchange with Bob
2. Valid signatures, key exchange succeeds
3. Monitor client UI:
   - Check for success indicator
   - Check for session status
   - Check chat interface availability
4. Verify success display:
   - Session established indicator shown
   - Chat interface becomes available
   - User can send messages
   - Encryption indicator shows (if implemented)
5. Verify UI state:
   - Session active
   - No error messages
   - Normal chat functionality available

**Expected Outcome:**

- Success indicator displayed
- Chat interface available
- User can communicate
- UI reflects successful session

**Evidence to Capture:**

- UI screenshot with success indicator
- Chat interface availability
- Session status
- Console success logs

**Pass/Fail Criteria:**

- PASS: Success displayed, chat available, session active
- FAIL: No success indicator or chat unavailable

**PDF Requirements Validated:**

- Client UI behavior
- Successful session establishment

---

## TC-ID: MITM-015

**Title:** Signed ECDH Variant - Complete MITM Attack Blocked
**Objective:** Verify complete MITM attack is blocked in signed ECDH variant
**Prerequisites:**

- Two authenticated users with identity keys
- Signed ECDH mode enabled
- MITM simulator access

**Detailed Steps:**

1. Run MITM simulation on signed ECDH:
   - `simulateMITMOnSignedECDH()` called
   - Attacker attempts to intercept and modify keys
2. Verify attack steps:
   - Attacker intercepts KEP_INIT
   - Attacker attempts to replace ephemeral key
   - Attacker forwards modified KEP_INIT to Bob
3. Verify attack blocked:
   - Bob verifies signature on modified key
   - Signature verification fails
   - KEP_INIT rejected
   - No session established
4. Verify logs:
   - Invalid signature logged
   - Attack attempt recorded
   - No successful session establishment
5. Verify result:
   - `attackSuccessful: false`
   - `attackerCanDecrypt: false`
   - `reason: "Signature verification prevents MITM"`

**Expected Outcome:**

- Complete MITM attack blocked
- Signature verification prevents attack
- No session established
- Attack logged

**Evidence to Capture:**

- MITM simulation result
- Signature verification failure
- Log entries
- Attack blocked confirmation

**Pass/Fail Criteria:**

- PASS: Attack blocked, no session established, logged
- FAIL: Attack succeeds or not logged

**PDF Requirements Validated:**

- Signed ECDH variant protection
- Complete MITM attack prevention

---

## TC-ID: MITM-016

**Title:** Signed ECDH Variant - Attacker Cannot Forge Signatures
**Objective:** Verify attacker cannot forge valid signatures without identity private key
**Prerequisites:**

- Two authenticated users with identity keys
- Signed ECDH mode enabled
- Attacker does not have identity private keys

**Detailed Steps:**

1. Alice generates KEP_INIT:
   - Signs ephemeral key with `IK_priv_A`
   - Signature is valid
2. Attacker intercepts KEP_INIT
3. Attacker attempts to forge signature:
   - Generates attacker ephemeral key
   - Attempts to sign with attacker's own identity key (if attacker has one)
   - Or attempts to modify signature bytes
4. Attacker creates modified KEP_INIT:
   - `ephPub = attackerEphPub`
   - `signature = forgedSignature` (or modified)
5. Bob receives modified KEP_INIT
6. Bob verifies signature:
   - Fetches Alice's identity public key: `IK_pub_A`
   - Verifies signature: `verifySignature(IK_pub_A, forgedSignature, attackerEphPub)`
7. Verify verification fails:
   - Signature verification returns `false`
   - Forged signature does not match
   - Error: "Invalid signature"

**Expected Outcome:**

- Attacker cannot forge valid signatures
- Forged signatures fail verification
- Modified KEP_INIT rejected
- Error logged

**Evidence to Capture:**

- Forged signature attempt
- Signature verification result (false)
- Error message
- Rejection confirmation

**Pass/Fail Criteria:**

- PASS: Forged signature fails, message rejected
- FAIL: Forged signature passes verification

**PDF Requirements Validated:**

- Signed ECDH variant protection
- Signature forgery prevention

---

## TC-ID: MITM-017

**Title:** Signed ECDH Variant - Key Confirmation Prevents Split Session
**Objective:** Verify key confirmation prevents split session attack even if signatures somehow pass
**Prerequisites:**

- Two authenticated users with identity keys
- Signed ECDH mode enabled
- Theoretical scenario where signatures pass but rootKeys differ

**Detailed Steps:**

1. Theoretical attack scenario:
   - Attacker somehow causes different rootKey derivation
   - Alice derives: `rootKey_Alice`
   - Bob derives: `rootKey_Bob`
   - `rootKey_Alice != rootKey_Bob`
2. Bob sends KEP_RESPONSE:
   - Computes: `keyConfirmation = HMAC(rootKey_Bob, "CONFIRM:" + aliceId)`
   - Includes in KEP_RESPONSE
3. Alice receives KEP_RESPONSE
4. Alice verifies key confirmation:
   - Computes: `keyConfirmation_expected = HMAC(rootKey_Alice, "CONFIRM:" + aliceId)`
   - Compares: `keyConfirmation == keyConfirmation_expected`
5. Verify mismatch detection:
   - `keyConfirmation != keyConfirmation_expected`
   - Key confirmation verification fails
   - Error: "Key confirmation failed"
6. Verify session rejection:
   - Session not established
   - Keys discarded
   - Error logged

**Expected Outcome:**

- Key confirmation detects rootKey mismatch
- Verification fails
- Session rejected
- Split session prevented

**Evidence to Capture:**

- Key confirmation values (different)
- Verification result (false)
- Error message
- Session rejection

**Pass/Fail Criteria:**

- PASS: Key confirmation mismatch detected, session rejected
- FAIL: Mismatch not detected or session established

**PDF Requirements Validated:**

- Signed ECDH variant protection
- Key confirmation prevents split session

---

## TC-ID: MITM-018

**Title:** Logs Show Invalid Signature Attacks - Multiple Attempts
**Objective:** Verify multiple invalid signature attacks are logged separately
**Prerequisites:**

- Two authenticated users with identity keys
- Signed ECDH mode enabled
- Multiple invalid signature attempts
- Access to server logs

**Detailed Steps:**

1. Attacker makes multiple MITM attempts:
   - Attempt 1: Invalid signature in KEP_INIT
   - Attempt 2: Invalid signature in KEP_RESPONSE
   - Attempt 3: Corrupted signature bytes
   - Attempt 4: Wrong identity key used
2. Each attempt causes signature verification failure
3. Check server logs: `server/logs/invalid_signature.log`
4. Verify log entries:
   - 4 log entries present (one per attempt)
   - Each entry is valid JSON
   - Each entry has unique timestamp (log time)
   - Each entry has correct structure
5. Verify entry differences:
   - Different `messageType` (KEP_INIT vs KEP_RESPONSE)
   - Different `reason` (if different failure modes)
   - Different `timestamp` (log time)
   - Same `sessionId` (if same session)

**Expected Outcome:**

- Multiple attacks logged separately
- Each entry is valid and structured
- Entries can be distinguished
- All entries follow same structure

**Evidence to Capture:**

- Multiple log entries
- Entry count verification
- Structure verification
- Timestamp comparison

**Pass/Fail Criteria:**

- PASS: All attacks logged, entries valid and structured
- FAIL: Missing entries or invalid structure

**PDF Requirements Validated:**

- Logs show invalid signature attacks
- Multiple attack logging

---

## TC-ID: MITM-019

**Title:** Client UI Behavior - Retry After Key Exchange Failure
**Objective:** Verify client UI allows retry after key exchange failure
**Prerequisites:**

- Two authenticated users
- Signed ECDH mode enabled
- Key exchange failure occurred
- Browser UI access

**Detailed Steps:**

1. Key exchange fails (invalid signature)
2. Error displayed to user
3. Verify retry option:
   - Check for "Retry" button or option
   - Check for "Try Again" link
   - Check for automatic retry (if implemented)
4. User clicks retry:
   - New key exchange initiated
   - New ephemeral keys generated
   - New KEP_INIT sent
5. Verify retry behavior:
   - New key exchange proceeds
   - If valid, session established
   - If invalid again, error shown again
   - User can retry multiple times

**Expected Outcome:**

- Retry option available
- User can retry key exchange
- New attempt proceeds
- Multiple retries possible

**Evidence to Capture:**

- Retry button/option
- Retry action
- New key exchange attempt
- Retry success/failure

**Pass/Fail Criteria:**

- PASS: Retry available, works, multiple retries possible
- FAIL: No retry option or retry doesn't work

**PDF Requirements Validated:**

- Client UI behavior
- Retry after failure

---

## TC-ID: MITM-020

**Title:** Comparison - Unsigned vs Signed ECDH Attack Results
**Objective:** Verify difference between unsigned and signed ECDH attack outcomes
**Prerequisites:**

- Two authenticated users
- MITM simulator access
- Both unsigned and signed ECDH modes available

**Detailed Steps:**

1. Run unsigned ECDH MITM simulation:
   - `simulateMITMOnUnsignedECDH()` called
   - Attack succeeds
   - Result: `attackSuccessful: true`
2. Run signed ECDH MITM simulation:
   - `simulateMITMOnSignedECDH()` called
   - Attack blocked
   - Result: `attackSuccessful: false`
3. Compare results:
   - Unsigned: Attack succeeds, attacker can decrypt
   - Signed: Attack blocked, signature verification fails
4. Verify logs:
   - Unsigned: No invalid signature logs (no signatures)
   - Signed: Invalid signature logs present
5. Verify session establishment:
   - Unsigned: Session established (but compromised)
   - Signed: Session rejected (protected)

**Expected Outcome:**

- Unsigned ECDH: Attack succeeds
- Signed ECDH: Attack blocked
- Logs show difference
- Session establishment differs

**Evidence to Capture:**

- Unsigned attack result
- Signed attack result
- Log comparison
- Session establishment comparison

**Pass/Fail Criteria:**

- PASS: Clear difference shown, unsigned vulnerable, signed protected
- FAIL: No difference or both vulnerable/protected

**PDF Requirements Validated:**

- Comparison of unsigned vs signed ECDH
- Attack outcome differences

---

**End of MITM Attack Testcase Suite**

