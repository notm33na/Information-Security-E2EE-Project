# Identity Key Management Testcase Suite

## TC-ID: IKM-001

**Title:** Identity Key Pair Generation - ECC P-256 Algorithm Verification
**Objective:** Verify that identity key pairs are generated using ECC P-256 (ECDSA) algorithm with correct parameters
**Prerequisites:**

- Browser with Web Crypto API support
- Test user account
- Access to browser DevTools console

**Detailed Steps:**

1. Open browser DevTools → Console tab
2. Navigate to registration page
3. Enter test email and password
4. Intercept `generateIdentityKeyPair()` function call
5. Verify key generation parameters:
   - Algorithm: `{name: 'ECDSA', namedCurve: 'P-256'}`
   - Extractable: `true`
   - Usages: `['sign', 'verify']`
6. Confirm key pair generation succeeds
7. Verify both privateKey and publicKey are CryptoKey objects

**Expected Outcome:**

- Key pair generated successfully
- Algorithm matches ECC P-256 (ECDSA) specification
- Keys are extractable for encrypted storage
- Private key has 'sign' usage, public key has 'verify' usage

**Evidence to Capture:**

- Console logs showing key generation
- Screenshot of key generation parameters
- Network trace showing no server involvement in key generation

**Pass/Fail Criteria:**

- PASS: Key pair generated with correct ECC P-256 parameters
- FAIL: Wrong algorithm, missing extractable flag, or incorrect usages

**PDF Requirements Validated:**

- Identity keys use ECC P-256 curve
- Keys generated client-side only

---

## TC-ID: IKM-002

**Title:** Ephemeral Key Pair Generation - ECDH P-256 Verification
**Objective:** Verify ephemeral key pairs are generated using ECDH P-256 for key exchange
**Prerequisites:**

- Authenticated user session
- Active chat session or key exchange initiation

**Detailed Steps:**

1. Log in as test user
2. Initiate key exchange with another user
3. Monitor `generateEphemeralKeyPair()` function execution
4. Verify ephemeral key generation parameters:
   - Algorithm: `{name: 'ECDH', namedCurve: 'P-256'}`
   - Extractable: `true`
   - Usages: `['deriveKey', 'deriveBits']`
5. Confirm ephemeral key pair generated successfully
6. Verify keys are NOT stored in IndexedDB (memory only)

**Expected Outcome:**

- Ephemeral key pair generated with ECDH P-256
- Keys exist only in memory
- Keys used for shared secret computation
- Keys discarded after session establishment

**Evidence to Capture:**

- Console logs of ephemeral key generation
- IndexedDB inspection showing no ephemeral keys stored
- Memory profiling showing keys cleared after use

**Pass/Fail Criteria:**

- PASS: Ephemeral keys generated with ECDH P-256, not persisted
- FAIL: Wrong algorithm, keys stored in IndexedDB, or keys not discarded

**PDF Requirements Validated:**

- Ephemeral keys use ECDH P-256
- Ephemeral keys are memory-only (not persisted)

---

## TC-ID: IKM-003

**Title:** Private Key Storage in IndexedDB - Encrypted Format Verification
**Objective:** Verify private identity keys are stored encrypted in IndexedDB with correct structure
**Prerequisites:**

- User registration completed
- Browser DevTools → Application → IndexedDB access

**Detailed Steps:**

1. Register new test user
2. Open DevTools → Application → IndexedDB
3. Navigate to `InfosecCryptoDB` → `identityKeys` object store
4. Locate entry for test user (keyed by userId)
5. Inspect stored data structure:
   - Verify `userId` field exists
   - Verify `encryptedData` is Array of numbers (Uint8Array serialized)
   - Verify `salt` is Array of 16 numbers (16 bytes)
   - Verify `iv` is Array of 12 numbers (12 bytes)
   - Verify `createdAt` is ISO timestamp string
6. Confirm NO plaintext private key fields present
7. Verify encryptedData length is reasonable (encrypted JWK size)

**Expected Outcome:**

- Private key stored in IndexedDB with encrypted format
- All required fields present (userId, encryptedData, salt, iv, createdAt)
- No plaintext private key material visible
- Encrypted data is binary array format

**Evidence to Capture:**

- Screenshot of IndexedDB entry structure
- JSON export of stored entry (with encryptedData visible but unreadable)
- Verification that no 'd' (private key component) field exists

**Pass/Fail Criteria:**

- PASS: Private key stored encrypted with all required fields
- FAIL: Plaintext key visible, missing fields, or incorrect data types

**PDF Requirements Validated:**

- Private keys stored encrypted in IndexedDB
- Storage structure matches specification

---

## TC-ID: IKM-004

**Title:** Private Key Encryption - PBKDF2 Key Derivation Verification
**Objective:** Verify private keys are encrypted using PBKDF2-derived keys from user password
**Prerequisites:**

- Test user with known password
- Access to browser console for function inspection

**Detailed Steps:**

1. Register test user with password: `TestPass123!`
2. Monitor `deriveKeyFromPassword()` function during registration
3. Verify PBKDF2 parameters:
   - Hash: SHA-256
   - Iterations: 100,000 (or configured value)
   - Salt: 16 random bytes (unique per key)
   - Derived key: AES-GCM, 256 bits
4. Verify encryption process:
   - Private key exported to JWK format
   - JWK serialized to ArrayBuffer
   - Encrypted with AES-GCM using derived key
   - IV: 12 bytes (96 bits) for GCM
5. Confirm different salts produce different encrypted outputs

**Expected Outcome:**

- PBKDF2 used with 100,000 iterations and SHA-256
- Unique salt generated per encryption
- AES-GCM encryption with 256-bit key
- Same password + different salt = different encrypted data

**Evidence to Capture:**

- Console logs showing PBKDF2 parameters
- Salt values (should be different for each key)
- Verification that iteration count is 100,000

**Pass/Fail Criteria:**

- PASS: PBKDF2 with 100k iterations, unique salts, AES-GCM encryption
- FAIL: Wrong iteration count, reused salts, or incorrect encryption algorithm

**PDF Requirements Validated:**

- Password-derived keys via PBKDF2
- 100,000+ iterations for key derivation
- AES-GCM encryption for private keys

---

## TC-ID: IKM-005

**Title:** Private Key Never Transmitted to Server - Network Traffic Verification
**Objective:** Verify private identity keys are never sent to server in any form
**Prerequisites:**

- Test user account
- Browser DevTools → Network tab
- Network traffic capture tool (optional)

**Detailed Steps:**

1. Register new test user
2. Open DevTools → Network tab
3. Filter for XHR/Fetch requests
4. Monitor all network requests during registration:
   - POST /api/auth/register
   - POST /api/keys/upload
5. Inspect request payloads:
   - Verify `/api/auth/register` contains only email and password (hashed server-side)
   - Verify `/api/keys/upload` contains only `publicIdentityKeyJWK` (no private key)
6. Check WebSocket connections (if any) for key material
7. Search all network traffic for:
   - Private key component 'd' in JWK
   - Encrypted private key data
   - Any base64-encoded key material
8. Verify no private key fields in any server request

**Expected Outcome:**

- No private key material in network traffic
- Only public key JWK sent to server
- No encrypted private key data transmitted
- All requests contain only public key information

**Evidence to Capture:**

- Network tab screenshots showing request payloads
- HAR file export (if available)
- Verification that no 'd' field exists in uploaded JWK
- Confirmation that encryptedData never appears in requests

**Pass/Fail Criteria:**

- PASS: No private key material in any network request
- FAIL: Private key component found in network traffic

**PDF Requirements Validated:**

- Private keys never leave client device
- Only public keys transmitted to server

---

## TC-ID: IKM-006

**Title:** Public Key JWK Export Format Verification
**Objective:** Verify public keys are exported in correct JWK format
**Prerequisites:**

- Test user with generated identity keys
- Browser console access

**Detailed Steps:**

1. Log in as test user
2. Execute `exportPublicKey(publicKey)` function
3. Verify JWK structure:
   - `kty`: "EC" (Elliptic Curve)
   - `crv`: "P-256" (curve name)
   - `x`: Base64-encoded X coordinate (present)
   - `y`: Base64-encoded Y coordinate (present)
   - `d`: MUST NOT be present (private key component)
4. Verify base64 encoding is valid
5. Verify coordinates are correct length for P-256 (32 bytes each)
6. Confirm JWK can be imported back as valid CryptoKey

**Expected Outcome:**

- JWK format matches specification
- All required fields present (kty, crv, x, y)
- No private key component (d) in exported JWK
- JWK can be successfully imported

**Evidence to Capture:**

- Exported JWK JSON structure
- Verification that 'd' field is absent
- Successful import test result

**Pass/Fail Criteria:**

- PASS: Valid JWK format with all required fields, no private component
- FAIL: Missing fields, private component present, or invalid format

**PDF Requirements Validated:**

- Public keys exported in JWK format
- JWK format: {kty: "EC", crv: "P-256", x: <base64>, y: <base64>}

---

## TC-ID: IKM-007

**Title:** Public Key JWK Import Verification
**Objective:** Verify public keys can be imported from JWK format correctly
**Prerequisites:**

- Valid JWK format public key
- Browser console access

**Detailed Steps:**

1. Obtain valid JWK public key (from server or test data)
2. Execute `importPublicKey(jwk)` function
3. Verify import parameters:
   - Algorithm: `{name: 'ECDSA', namedCurve: 'P-256'}`
   - Extractable: `true`
   - Usages: `['verify']`
4. Confirm imported key is valid CryptoKey
5. Test key can be used for signature verification
6. Verify invalid JWK formats are rejected:
   - Missing 'x' or 'y' coordinates
   - Wrong curve (not P-256)
   - Wrong key type (not EC)
   - Contains private key component 'd'

**Expected Outcome:**

- Valid JWK successfully imported as CryptoKey
- Imported key can verify signatures
- Invalid JWK formats rejected with appropriate errors

**Evidence to Capture:**

- Successful import result
- Error messages for invalid JWK formats
- Signature verification test result

**Pass/Fail Criteria:**

- PASS: Valid JWK imports successfully, invalid formats rejected
- FAIL: Import fails for valid JWK or accepts invalid formats

**PDF Requirements Validated:**

- Public keys can be imported from JWK format
- Import validates JWK structure

---

## TC-ID: IKM-008

**Title:** Private Key Decryption - Password Verification
**Objective:** Verify private keys can be decrypted only with correct password
**Prerequisites:**

- Test user with stored encrypted private key
- Known correct password
- Browser console access

**Detailed Steps:**

1. Log in as test user
2. Attempt to load private key with correct password
3. Verify decryption process:
   - Load encrypted data from IndexedDB
   - Derive decryption key using PBKDF2 with stored salt
   - Decrypt using AES-GCM with stored IV
   - Import decrypted JWK as CryptoKey
4. Confirm private key loads successfully
5. Test with incorrect password:
   - Attempt decryption with wrong password
   - Verify decryption fails (authentication tag verification fails)
6. Verify error handling for wrong password

**Expected Outcome:**

- Correct password successfully decrypts private key
- Wrong password causes decryption failure
- Error message indicates authentication failure
- No partial key material exposed on failure

**Evidence to Capture:**

- Successful decryption with correct password
- Error message for incorrect password
- Verification that wrong password produces OperationError

**Pass/Fail Criteria:**

- PASS: Correct password decrypts, wrong password fails securely
- FAIL: Wrong password succeeds or exposes key material

**PDF Requirements Validated:**

- Private key decryption requires correct password
- Wrong password causes secure failure

---

## TC-ID: IKM-009

**Title:** Server Public Key Directory - JWK Format Validation
**Objective:** Verify server validates and stores public keys in correct format
**Prerequisites:**

- Authenticated test user
- Access to server logs
- MongoDB access (optional)

**Detailed Steps:**

1. Upload valid public key JWK via POST /api/keys/upload
2. Verify server validation:
   - Checks for required fields (kty, crv, x, y)
   - Validates kty === "EC"
   - Validates crv === "P-256"
   - Rejects if 'd' (private key component) present
3. Verify server storage:
   - Public key stored in MongoDB PublicKey collection
   - keyHash computed and stored (SHA-256)
   - version field set (default: 1)
   - createdAt and updatedAt timestamps set
4. Test invalid JWK rejection:
   - Missing 'x' or 'y' coordinates
   - Wrong curve (e.g., P-384)
   - Contains 'd' field
   - Invalid base64 encoding

**Expected Outcome:**

- Valid JWK accepted and stored correctly
- Invalid JWK formats rejected with 400 error
- Server validates JWK structure before storage
- keyHash computed for integrity verification

**Evidence to Capture:**

- Server response for valid key upload
- Error responses for invalid JWK formats
- MongoDB document structure (if accessible)
- Server logs showing validation steps

**Pass/Fail Criteria:**

- PASS: Valid JWK stored, invalid formats rejected
- FAIL: Invalid JWK accepted or valid JWK rejected incorrectly

**PDF Requirements Validated:**

- Server validates JWK format
- Only EC P-256 public keys accepted
- Private key components rejected

---

## TC-ID: IKM-010

**Title:** Server Public Key Directory - Integrity Hash Verification
**Objective:** Verify server computes and verifies SHA-256 hash of public keys
**Prerequisites:**

- Test user with uploaded public key
- MongoDB access or server logs

**Detailed Steps:**

1. Upload public key to server
2. Retrieve stored public key from MongoDB
3. Verify keyHash computation:
   - Server computes SHA-256 of sorted JWK JSON
   - Hash stored in keyHash field
   - Hash used for integrity verification
4. Test integrity verification:
   - Retrieve public key via GET /api/keys/:userId
   - Server recomputes hash and compares with stored hash
   - Verify hash matches
5. Test tamper detection:
   - Manually modify JWK in database (if possible)
   - Attempt to retrieve key
   - Verify server detects hash mismatch
   - Verify security event logged

**Expected Outcome:**

- keyHash computed correctly on upload
- Hash verified on retrieval
- Tampered key detected and logged
- Security event generated for tamper attempts

**Evidence to Capture:**

- keyHash value in database
- Hash verification logs
- Tamper detection log entry
- Security event log entry

**Pass/Fail Criteria:**

- PASS: Hash computed correctly, tampering detected
- FAIL: Hash missing, incorrect, or tampering not detected

**PDF Requirements Validated:**

- Server computes SHA-256 hash of public keys
- Hash used for integrity verification

---

## TC-ID: IKM-011

**Title:** Public Key Upload - Private Key Component Rejection
**Objective:** Verify server rejects JWK containing private key component 'd'
**Prerequisites:**

- Authenticated test user
- Test JWK with private key component

**Detailed Steps:**

1. Create test JWK with private key component:
   ```json
   {
     "kty": "EC",
     "crv": "P-256",
     "x": "...",
     "y": "...",
     "d": "private_key_component"
   }
   ```
2. Attempt to upload via POST /api/keys/upload
3. Verify server validation:
   - Server checks for 'd' field presence
   - Server rejects request with 400 error
   - Error message indicates private key component detected
4. Verify no key stored in database
5. Verify security log entry (if implemented)

**Expected Outcome:**

- Server rejects JWK with 'd' field
- 400 error returned with clear message
- No key stored in database
- Security event logged (if applicable)

**Evidence to Capture:**

- Server error response
- Database verification (no key stored)
- Security log entry (if available)

**Pass/Fail Criteria:**

- PASS: Private key component rejected, no storage
- FAIL: Private key component accepted or stored

**PDF Requirements Validated:**

- Server must reject JWK with private key components
- Private keys never stored on server

---

## TC-ID: IKM-012

**Title:** Public Key Retrieval - Correct User Association
**Objective:** Verify public keys are correctly associated with user IDs
**Prerequisites:**

- Multiple test users with uploaded public keys
- Access to GET /api/keys/:userId endpoint

**Detailed Steps:**

1. Upload public keys for User A and User B
2. Retrieve User A's public key via GET /api/keys/:userIdA
3. Verify returned key matches User A's uploaded key
4. Retrieve User B's public key via GET /api/keys/:userIdB
5. Verify returned key matches User B's uploaded key
6. Verify keys are different (different users have different keys)
7. Test non-existent user:
   - Request key for non-existent userId
   - Verify 404 error returned

**Expected Outcome:**

- Each user's public key correctly retrieved
- Keys match uploaded values
- Different users have different keys
- Non-existent user returns 404

**Evidence to Capture:**

- Retrieved JWK for each user
- Comparison with uploaded keys
- 404 response for non-existent user

**Pass/Fail Criteria:**

- PASS: Correct keys retrieved for each user, 404 for missing
- FAIL: Wrong key returned or incorrect error handling

**PDF Requirements Validated:**

- Public keys correctly associated with user IDs
- Key retrieval works correctly

---

## TC-ID: IKM-013

**Title:** Identity Key Rotation - New Key Generation
**Objective:** Verify identity key rotation generates new key pair
**Prerequisites:**

- Test user with existing identity keys
- Access to key rotation function

**Detailed Steps:**

1. Retrieve current public key for test user
2. Execute `rotateIdentityKeys(userId, password)`
3. Verify new key generation:
   - New ECC P-256 key pair generated
   - New private key encrypted and stored
   - New public key exported to JWK
4. Compare new public key with old:
   - Verify keys are different (x, y coordinates differ)
5. Verify old private key replaced in IndexedDB
6. Upload new public key to server

**Expected Outcome:**

- New key pair generated successfully
- New keys differ from old keys
- Old private key replaced in IndexedDB
- New public key can be uploaded

**Evidence to Capture:**

- Old and new public key JWKs (showing different values)
- IndexedDB entry showing updated encryptedData
- Server confirmation of new key upload

**Pass/Fail Criteria:**

- PASS: New keys generated and differ from old keys
- FAIL: Same keys generated or rotation fails

**PDF Requirements Validated:**

- Identity key rotation generates new key pairs
- Old keys replaced with new keys

---

## TC-ID: IKM-014

**Title:** Identity Key Rotation - Server Version Tracking
**Objective:** Verify server tracks key versions and archives previous versions
**Prerequisites:**

- Test user with existing public key
- MongoDB access (optional)

**Detailed Steps:**

1. Upload initial public key (version 1)
2. Rotate identity keys client-side
3. Upload new public key to server
4. Verify server version tracking:
   - version field incremented (1 → 2)
   - Old keyHash added to previousVersions array
   - replacedAt timestamp set for archived version
   - New keyHash computed and stored
5. Retrieve public key and verify current version
6. Check previousVersions array contains old key hash

**Expected Outcome:**

- Version incremented on key rotation
- Previous version archived in previousVersions array
- Timestamps correctly set
- Current key hash matches new key

**Evidence to Capture:**

- MongoDB document showing version increment
- previousVersions array with archived key hash
- Timestamps for version changes

**Pass/Fail Criteria:**

- PASS: Version tracking works, previous versions archived
- FAIL: Version not incremented or previous version not archived

**PDF Requirements Validated:**

- Server tracks key versions
- Previous versions archived

---

## TC-ID: IKM-015

**Title:** Identity Key Rotation - Old Key Invalidation
**Objective:** Verify old identity keys cannot be used after rotation
**Prerequisites:**

- Test user with rotated identity keys
- Old and new key pairs available

**Detailed Steps:**

1. Rotate identity keys for test user
2. Attempt to use old private key for signing:
   - Load old private key (if still accessible)
   - Attempt to sign message with old key
3. Verify new public key on server:
   - Retrieve current public key
   - Verify it matches new key (not old key)
4. Attempt signature verification:
   - Sign with new private key
   - Verify with new public key (should succeed)
   - Sign with old private key
   - Verify with new public key (should fail)
5. Verify old key cannot decrypt new encrypted data

**Expected Outcome:**

- Old private key cannot be used after rotation
- New public key on server matches new private key
- Signatures with old key fail verification
- New key pair works correctly

**Evidence to Capture:**

- Signature verification results (old key fails, new key succeeds)
- Server public key matches new key
- Error messages for old key usage

**Pass/Fail Criteria:**

- PASS: Old keys invalidated, new keys work
- FAIL: Old keys still usable or new keys don't work

**PDF Requirements Validated:**

- Key rotation invalidates old keys
- New keys must be used after rotation

---

## TC-ID: IKM-016

**Title:** Key Rotation Recommendation - Age-Based Check
**Objective:** Verify system recommends key rotation after 90 days
**Prerequisites:**

- Test user with key createdAt timestamp
- Access to `shouldRotateIdentityKey()` function

**Detailed Steps:**

1. Create test key with createdAt = 89 days ago
2. Execute `shouldRotateIdentityKey(keyCreatedAt, 90)`
3. Verify returns `false` (not yet 90 days)
4. Create test key with createdAt = 91 days ago
5. Execute `shouldRotateIdentityKey(keyCreatedAt, 90)`
6. Verify returns `true` (exceeds 90 days)
7. Test with custom maxAgeDays parameter
8. Verify edge case: exactly 90 days

**Expected Outcome:**

- Returns false for keys < 90 days old
- Returns true for keys > 90 days old
- Custom maxAgeDays parameter works
- Edge cases handled correctly

**Evidence to Capture:**

- Function return values for different key ages
- Test results with various age parameters

**Pass/Fail Criteria:**

- PASS: Correct recommendation based on key age
- FAIL: Incorrect age calculation or recommendation

**PDF Requirements Validated:**

- Key rotation recommended after 90 days
- Age-based rotation check implemented

---

## TC-ID: IKM-017

**Title:** Log File Inspection - No Plaintext Keys
**Objective:** Verify no plaintext private keys appear in any log files
**Prerequisites:**

- Test user with identity keys
- Access to server log files
- Access to client-side logs (if any)

**Detailed Steps:**

1. Perform key operations:
   - Register user (generates keys)
   - Upload public key
   - Rotate keys
2. Inspect server log files:
   - `server/logs/security-*.log`
   - `server/logs/auth-*.log`
   - `server/logs/app-*.log`
   - `server/logs/error-*.log`
3. Search for private key indicators:
   - Search for 'd' field (private key component)
   - Search for 'privateKey' strings
   - Search for base64-encoded key material
   - Search for encrypted key data
4. Verify only public key JWKs appear (without 'd' field)
5. Check client console logs (if accessible)
6. Verify no private key material in any log

**Expected Outcome:**

- No private key components in log files
- Only public key JWKs logged (if any)
- No encrypted key data in logs
- Logs contain only metadata (user IDs, timestamps, events)

**Evidence to Capture:**

- Log file excerpts showing no private keys
- Search results confirming absence of 'd' field
- Verification that only public keys appear

**Pass/Fail Criteria:**

- PASS: No private key material in any log file
- FAIL: Private key components found in logs

**PDF Requirements Validated:**

- No plaintext keys in logs
- Only public key information logged

---

## TC-ID: IKM-018

**Title:** IndexedDB Isolation - Per-Origin Storage Verification
**Objective:** Verify IndexedDB keys are isolated per browser origin
**Prerequisites:**

- Two different origins (e.g., localhost:5173 and localhost:3000)
- Test user accounts on both origins

**Detailed Steps:**

1. Register User A on Origin 1 (localhost:5173)
2. Verify keys stored in Origin 1's IndexedDB
3. Register User B on Origin 2 (localhost:3000)
4. Verify keys stored in Origin 2's IndexedDB
5. Attempt to access Origin 1's IndexedDB from Origin 2:
   - Verify access denied (same-origin policy)
6. Verify each origin has separate IndexedDB:
   - Different database instances
   - Keys not accessible across origins
7. Verify same user on different origins has different keys

**Expected Outcome:**

- Each origin has isolated IndexedDB
- Keys not accessible across origins
- Same-origin policy enforced
- Different origins generate different keys for same user

**Evidence to Capture:**

- IndexedDB contents for each origin
- Verification of isolation
- Error messages for cross-origin access attempts

**Pass/Fail Criteria:**

- PASS: IndexedDB isolated per origin, no cross-origin access
- FAIL: Keys accessible across origins or isolation broken

**PDF Requirements Validated:**

- IndexedDB isolated per origin
- Same-origin policy enforced

---

## TC-ID: IKM-019

**Title:** Key Storage Encryption - Salt Uniqueness Verification
**Objective:** Verify each encrypted private key uses unique salt
**Prerequisites:**

- Multiple test users or multiple key rotations
- Access to IndexedDB entries

**Detailed Steps:**

1. Register User A and store private key
2. Register User B and store private key
3. Retrieve both encrypted keys from IndexedDB
4. Compare salt values:
   - Verify User A's salt ≠ User B's salt
5. Rotate User A's keys
6. Compare old and new salts:
   - Verify new salt ≠ old salt
7. Verify salt is 16 bytes (Array of 16 numbers)
8. Verify salt is cryptographically random (not predictable)

**Expected Outcome:**

- Each key encryption uses unique salt
- Salts are 16 bytes in length
- Salts appear random (not sequential or predictable)
- Same password + different salt = different encrypted data

**Evidence to Capture:**

- Salt values from multiple keys
- Verification of uniqueness
- Salt length verification

**Pass/Fail Criteria:**

- PASS: Unique salts for each key, proper length, random
- FAIL: Reused salts, wrong length, or predictable values

**PDF Requirements Validated:**

- Unique salt per key encryption
- Salt prevents rainbow table attacks

---

## TC-ID: IKM-020

**Title:** Key Storage Encryption - IV Uniqueness Verification
**Objective:** Verify each encrypted private key uses unique IV
**Prerequisites:**

- Multiple test users or multiple key rotations
- Access to IndexedDB entries

**Detailed Steps:**

1. Register User A and store private key
2. Register User B and store private key
3. Retrieve both encrypted keys from IndexedDB
4. Compare IV values:
   - Verify User A's IV ≠ User B's IV
5. Rotate User A's keys
6. Compare old and new IVs:
   - Verify new IV ≠ old IV
7. Verify IV is 12 bytes (96 bits for GCM)
8. Verify IV is cryptographically random

**Expected Outcome:**

- Each key encryption uses unique IV
- IVs are 12 bytes in length
- IVs appear random
- Same key + different IV = different ciphertext

**Evidence to Capture:**

- IV values from multiple keys
- Verification of uniqueness
- IV length verification

**Pass/Fail Criteria:**

- PASS: Unique IVs for each key, proper length (12 bytes), random
- FAIL: Reused IVs, wrong length, or predictable values

**PDF Requirements Validated:**

- Unique IV per encryption
- IV ensures unique ciphertexts

---

## TC-ID: IKM-021

**Title:** Ephemeral Key Memory-Only Storage Verification
**Objective:** Verify ephemeral keys are never persisted to IndexedDB
**Prerequisites:**

- Active key exchange session
- Access to IndexedDB and memory inspection

**Detailed Steps:**

1. Initiate key exchange between two users
2. Monitor ephemeral key generation
3. Verify ephemeral keys exist only in memory:
   - Check IndexedDB for ephemeral keys (should not exist)
   - Verify keys in JavaScript memory (temporary variables)
4. Complete key exchange
5. Verify ephemeral keys cleared from memory:
   - Check that key variables are undefined/null
   - Verify no references remain
6. Attempt to retrieve ephemeral keys from IndexedDB:
   - Verify no storage occurred
7. Verify only session keys (derived from ephemeral) are stored

**Expected Outcome:**

- Ephemeral keys never stored in IndexedDB
- Ephemeral keys exist only in memory during key exchange
- Keys cleared from memory after use
- Only derived session keys are persisted

**Evidence to Capture:**

- IndexedDB contents (no ephemeral keys)
- Memory inspection showing temporary key variables
- Verification that keys are cleared after use

**Pass/Fail Criteria:**

- PASS: Ephemeral keys never persisted, cleared after use
- FAIL: Ephemeral keys stored or not cleared

**PDF Requirements Validated:**

- Ephemeral keys are memory-only
- Keys discarded after session establishment

---

## TC-ID: IKM-022

**Title:** Public Key Server Validation - Curve Type Enforcement
**Objective:** Verify server only accepts P-256 curve keys
**Prerequisites:**

- Authenticated test user
- Test JWKs with different curves

**Detailed Steps:**

1. Create test JWK with P-384 curve:
   ```json
   { "kty": "EC", "crv": "P-384", "x": "...", "y": "..." }
   ```
2. Attempt upload via POST /api/keys/upload
3. Verify server rejects with 400 error
4. Create test JWK with P-521 curve
5. Attempt upload
6. Verify rejection
7. Create test JWK with P-256 curve
8. Verify acceptance
9. Verify error message indicates P-256 requirement

**Expected Outcome:**

- P-384 and P-521 keys rejected
- P-256 keys accepted
- Clear error messages for unsupported curves
- Only P-256 keys stored in database

**Evidence to Capture:**

- Error responses for non-P-256 curves
- Success response for P-256 key
- Server validation logs

**Pass/Fail Criteria:**

- PASS: Only P-256 accepted, other curves rejected
- FAIL: Non-P-256 curves accepted or P-256 rejected

**PDF Requirements Validated:**

- Server enforces P-256 curve requirement
- Only ECC P-256 keys supported

---

## TC-ID: IKM-023

**Title:** Key Deletion - IndexedDB Cleanup Verification
**Objective:** Verify identity keys can be deleted from IndexedDB
**Prerequisites:**

- Test user with stored identity keys
- Access to `deleteIdentityKey()` function

**Detailed Steps:**

1. Verify key exists in IndexedDB for test user
2. Execute `deleteIdentityKey(userId)`
3. Verify deletion:
   - Check IndexedDB entry removed
   - Verify `hasIdentityKey(userId)` returns false
4. Attempt to load deleted key:
   - Execute `loadPrivateKey(userId, password)`
   - Verify error: "Private key not found for user"
5. Verify deletion is permanent:
   - Refresh page
   - Verify key still deleted
6. Verify server public key unaffected (still exists)

**Expected Outcome:**

- Key successfully deleted from IndexedDB
- hasIdentityKey returns false after deletion
- Loading deleted key fails with appropriate error
- Deletion is permanent
- Server public key remains (not deleted)

**Evidence to Capture:**

- IndexedDB before and after deletion
- Error message for loading deleted key
- Verification that server key still exists

**Pass/Fail Criteria:**

- PASS: Key deleted from IndexedDB, cannot be loaded
- FAIL: Key not deleted or still accessible

**PDF Requirements Validated:**

- Key deletion functionality works
- Deleted keys cannot be recovered

---

## TC-ID: IKM-024

**Title:** Key Export/Import Round-Trip Verification
**Objective:** Verify public keys can be exported and imported successfully
**Prerequisites:**

- Test user with identity keys
- Browser console access

**Detailed Steps:**

1. Generate identity key pair
2. Export public key to JWK format
3. Verify exported JWK structure is valid
4. Import exported JWK back as CryptoKey
5. Verify imported key is valid:
   - Check algorithm matches (ECDSA P-256)
   - Check usages include 'verify'
6. Test signature verification:
   - Sign test message with private key
   - Verify signature with imported public key
   - Verify signature verification succeeds
7. Verify exported and imported keys are equivalent

**Expected Outcome:**

- Public key exports to valid JWK
- JWK imports back to valid CryptoKey
- Imported key can verify signatures
- Export/import round-trip successful

**Evidence to Capture:**

- Exported JWK format
- Successful import result
- Signature verification test result

**Pass/Fail Criteria:**

- PASS: Export/import round-trip successful, signatures verify
- FAIL: Export or import fails, or signatures don't verify

**PDF Requirements Validated:**

- JWK export/import works correctly
- Keys remain valid after round-trip

---

## TC-ID: IKM-025

**Title:** Multiple Key Generation - Uniqueness Verification
**Objective:** Verify each key generation produces unique keys
**Prerequisites:**

- Ability to generate multiple key pairs
- Browser console access

**Detailed Steps:**

1. Generate first identity key pair (Key Pair 1)
2. Export public key 1 to JWK
3. Generate second identity key pair (Key Pair 2)
4. Export public key 2 to JWK
5. Compare public keys:
   - Verify x coordinates differ
   - Verify y coordinates differ
6. Generate third key pair
7. Verify all three keys are unique
8. Verify keys are cryptographically random (not sequential)

**Expected Outcome:**

- Each key generation produces unique keys
- Public key coordinates differ for each key
- Keys appear random (not predictable)
- No collisions in generated keys

**Evidence to Capture:**

- Multiple public key JWKs showing different values
- Verification of uniqueness
- Statistical analysis (if possible)

**Pass/Fail Criteria:**

- PASS: All generated keys are unique
- FAIL: Duplicate keys generated or keys are predictable

**PDF Requirements Validated:**

- Key generation produces unique keys
- Keys are cryptographically random

---

## TC-ID: IKM-026

**Title:** Key Storage Error Handling - Invalid Password
**Objective:** Verify proper error handling when storing keys with invalid password
**Prerequisites:**

- Test user registration flow
- Ability to test with invalid passwords

**Detailed Steps:**

1. Attempt to store private key with empty password
2. Verify error handling:
   - Appropriate error thrown
   - Key not stored in IndexedDB
3. Attempt with null password
4. Verify error handling
5. Attempt with very long password (edge case)
6. Verify key storage succeeds (if password valid)
7. Verify error messages are clear but don't leak information

**Expected Outcome:**

- Invalid passwords cause appropriate errors
- Keys not stored with invalid passwords
- Error messages are clear
- No sensitive information leaked in errors

**Evidence to Capture:**

- Error messages for invalid passwords
- Verification that keys not stored
- Error message content review

**Pass/Fail Criteria:**

- PASS: Invalid passwords handled correctly, no information leakage
- FAIL: Invalid passwords accepted or information leaked

**PDF Requirements Validated:**

- Error handling for invalid inputs
- No information leakage in error messages

---

## TC-ID: IKM-027

**Title:** Server Key Retrieval - Authentication Requirement
**Objective:** Verify public key retrieval requires proper authentication
**Prerequisites:**

- Test user with uploaded public key
- Ability to make unauthenticated requests

**Detailed Steps:**

1. Attempt to retrieve public key without authentication:
   - GET /api/keys/:userId without JWT token
   - Verify 401 Unauthorized response
2. Attempt with invalid token:
   - Use expired or malformed JWT
   - Verify 401 response
3. Authenticate and retrieve key:
   - Use valid JWT token
   - Verify 200 response with key
4. Test authorization:
   - User A attempts to modify User B's key
   - Verify authorization check (if implemented)

**Expected Outcome:**

- Unauthenticated requests rejected (401)
- Invalid tokens rejected (401)
- Authenticated requests succeed (200)
- Authorization enforced (if applicable)

**Evidence to Capture:**

- 401 responses for unauthenticated requests
- 200 response for authenticated request
- Authorization error (if applicable)

**Pass/Fail Criteria:**

- PASS: Authentication required, authorization enforced
- FAIL: Unauthenticated access allowed or authorization bypassed

**PDF Requirements Validated:**

- Public key operations require authentication
- Authorization checks enforced

---

## TC-ID: IKM-028

**Title:** Key Rotation Logging - Security Event Recording
**Objective:** Verify key rotation events are logged appropriately
**Prerequisites:**

- Test user with identity keys
- Access to server logs
- Key rotation capability

**Detailed Steps:**

1. Rotate identity keys for test user
2. Upload new public key to server
3. Check server logs for rotation events:
   - Security log entries
   - Key update events
   - Version change logging
4. Verify logged information:
   - User ID logged
   - Timestamp logged
   - Version change logged
   - No private key material in logs
5. Verify previous version archived in logs (if logged)
6. Check for any security alerts related to rotation

**Expected Outcome:**

- Key rotation events logged
- Logs contain metadata (user ID, timestamp, version)
- No private key material in logs
- Previous version information logged (if applicable)

**Evidence to Capture:**

- Log entries for key rotation
- Verification of logged metadata
- Confirmation of no private keys in logs

**Pass/Fail Criteria:**

- PASS: Rotation events logged with metadata, no private keys
- FAIL: Events not logged or private keys in logs

**PDF Requirements Validated:**

- Key rotation events are logged
- Logs contain only metadata, no private keys

---

## TC-ID: IKM-029

**Title:** Concurrent Key Operations - Race Condition Handling
**Objective:** Verify system handles concurrent key operations correctly
**Prerequisites:**

- Test user account
- Ability to perform concurrent operations

**Detailed Steps:**

1. Simultaneously attempt:
   - Load private key
   - Rotate keys
   - Upload public key
2. Verify operations complete without corruption:
   - No data loss
   - Keys remain consistent
   - IndexedDB integrity maintained
3. Test concurrent key generation:
   - Generate multiple key pairs simultaneously
   - Verify all keys are unique
   - Verify all keys stored correctly
4. Test concurrent uploads:
   - Upload same public key multiple times
   - Verify last write wins or conflict resolution

**Expected Outcome:**

- Concurrent operations handled correctly
- No data corruption
- Keys remain consistent
- Race conditions don't cause failures

**Evidence to Capture:**

- Concurrent operation results
- Verification of data consistency
- Error handling (if any)

**Pass/Fail Criteria:**

- PASS: Concurrent operations succeed, no corruption
- FAIL: Data corruption or operation failures

**PDF Requirements Validated:**

- System handles concurrent operations
- Data integrity maintained

---

## TC-ID: IKM-030

**Title:** Key Storage Persistence - Browser Restart Verification
**Objective:** Verify encrypted keys persist across browser restarts
**Prerequisites:**

- Test user with stored identity keys
- Ability to restart browser

**Detailed Steps:**

1. Register test user and store identity keys
2. Verify keys in IndexedDB
3. Close browser completely
4. Restart browser
5. Navigate to application
6. Log in with same credentials
7. Attempt to load private key:
   - Execute `loadPrivateKey(userId, password)`
   - Verify key loads successfully
8. Verify key is same as before restart:
   - Compare public key (should match)
   - Verify key can sign messages
9. Verify IndexedDB data persisted:
   - Check IndexedDB entry still exists
   - Verify encryptedData, salt, iv unchanged

**Expected Outcome:**

- Keys persist across browser restart
- Keys can be loaded after restart
- Keys remain functional (can sign)
- IndexedDB data unchanged

**Evidence to Capture:**

- IndexedDB before and after restart
- Successful key load after restart
- Signature test with persisted key

**Pass/Fail Criteria:**

- PASS: Keys persist and work after browser restart
- FAIL: Keys lost or non-functional after restart

**PDF Requirements Validated:**

- IndexedDB provides persistent storage
- Keys survive browser restarts

---

**End of Identity Key Management Testcase Suite**
