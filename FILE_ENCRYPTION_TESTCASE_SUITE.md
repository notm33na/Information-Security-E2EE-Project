# File Encryption Testcase Suite

## TC-ID: FILE-001

**Title:** Client-Side File Encryption - Single Chunk File
**Objective:** Verify file encryption works correctly for files smaller than 256KB
**Prerequisites:**

- Established session with valid keys
- Test file < 256KB (e.g., 50KB text file)
- Browser console access

**Detailed Steps:**

1. Alice selects file (50KB text file)
2. Monitor `encryptFile()` function execution
3. Verify file read:
   - `file.arrayBuffer()` called
   - File size = 50KB
4. Verify chunk calculation:
   - `totalChunks = Math.ceil(50KB / 256KB) = 1`
5. Verify metadata encryption:
   - Metadata JSON created: `{filename, size: 50KB, totalChunks: 1, mimetype}`
   - Metadata encrypted with AES-256-GCM
   - FILE_META envelope built
6. Verify chunk encryption:
   - Single chunk encrypted with AES-256-GCM
   - Fresh IV generated (12 bytes)
   - AuthTag generated (16 bytes)
   - FILE_CHUNK envelope built with `chunkIndex: 0, totalChunks: 1`
7. Verify return value:
   - `fileMetaEnvelope` returned
   - `chunkEnvelopes` array with 1 element

**Expected Outcome:**

- File encrypted successfully
- 1 FILE_META envelope created
- 1 FILE_CHUNK envelope created
- All encryption components present

**Evidence to Capture:**

- FILE_META envelope structure
- FILE_CHUNK envelope structure
- Encryption function execution
- Chunk count verification

**Pass/Fail Criteria:**

- PASS: File encrypted, correct number of chunks, envelopes valid
- FAIL: Encryption fails or incorrect chunk count

**PDF Requirements Validated:**

- Client-side file encryption
- Single chunk file handling

---

## TC-ID: FILE-002

**Title:** Client-Side File Encryption - Multi-Chunk File
**Objective:** Verify file encryption works correctly for files larger than 256KB
**Prerequisites:**

- Established session with valid keys
- Test file > 256KB (e.g., 500KB image file)
- Browser console access

**Detailed Steps:**

1. Alice selects file (500KB image file)
2. Monitor `encryptFile()` function execution
3. Verify file read:
   - `file.arrayBuffer()` called
   - File size = 500KB
4. Verify chunk calculation:
   - `totalChunks = Math.ceil(500KB / 256KB) = 2`
5. Verify metadata encryption:
   - Metadata JSON created: `{filename, size: 500KB, totalChunks: 2, mimetype}`
   - Metadata encrypted with AES-256-GCM
   - FILE_META envelope built
6. Verify chunk encryption:
   - Chunk 0: bytes 0-256KB encrypted
   - Chunk 1: bytes 256KB-500KB encrypted
   - Each chunk encrypted independently with AES-256-GCM
   - Fresh IV generated for each chunk (12 bytes)
   - AuthTag generated for each chunk (16 bytes)
   - FILE_CHUNK envelopes built with correct `chunkIndex` (0, 1) and `totalChunks: 2`
7. Verify return value:
   - `fileMetaEnvelope` returned
   - `chunkEnvelopes` array with 2 elements

**Expected Outcome:**

- File encrypted successfully
- 1 FILE_META envelope created
- 2 FILE_CHUNK envelopes created
- All chunks encrypted independently

**Evidence to Capture:**

- FILE_META envelope structure
- FILE_CHUNK envelopes structure
- Chunk indices verification
- Encryption function execution

**Pass/Fail Criteria:**

- PASS: File encrypted, correct number of chunks, all chunks encrypted
- FAIL: Encryption fails or incorrect chunk count

**PDF Requirements Validated:**

- Client-side file encryption
- Multi-chunk file handling

---

## TC-ID: FILE-003

**Title:** AES-GCM on File Chunks - Encryption Algorithm
**Objective:** Verify each file chunk is encrypted with AES-256-GCM
**Prerequisites:**

- Established session with valid keys
- Test file (multi-chunk)
- Browser console access

**Detailed Steps:**

1. Alice selects file (500KB)
2. Monitor `encryptAESGCM()` calls for chunks
3. Verify encryption algorithm:
   - Key imported as `{name: 'AES-GCM', length: 256}`
   - Algorithm: AES-GCM
   - Key length: 256 bits
   - Tag length: 128 bits
4. Verify each chunk encrypted:
   - Chunk 0 encrypted with AES-256-GCM
   - Chunk 1 encrypted with AES-256-GCM
   - Each produces ciphertext + authTag
5. Verify encryption results:
   - Ciphertext extracted (encrypted.slice(0, -16))
   - AuthTag extracted (encrypted.slice(-16))
   - Both base64-encoded in envelope

**Expected Outcome:**

- All chunks encrypted with AES-256-GCM
- Correct algorithm parameters
- Ciphertext and authTag extracted correctly

**Evidence to Capture:**

- Encryption algorithm parameters
- Ciphertext and authTag extraction
- Base64 encoding verification

**Pass/Fail Criteria:**

- PASS: All chunks encrypted with AES-256-GCM, correct parameters
- FAIL: Wrong algorithm or incorrect extraction

**PDF Requirements Validated:**

- AES-256-GCM encryption on file chunks

---

## TC-ID: FILE-004

**Title:** Fresh IV Per Chunk - Uniqueness Verification
**Objective:** Verify each file chunk uses a unique IV
**Prerequisites:**

- Established session with valid keys
- Test file (multi-chunk, e.g., 500KB)
- Browser console access

**Detailed Steps:**

1. Alice selects file (500KB, 2 chunks)
2. Monitor `generateIV()` calls during encryption
3. Verify IV generation:
   - `crypto.getRandomValues(new Uint8Array(12))` called for each chunk
   - IV length: 12 bytes (96 bits)
4. Verify IV uniqueness:
   - Chunk 0 IV: Extract from envelope
   - Chunk 1 IV: Extract from envelope
   - Metadata IV: Extract from FILE_META envelope
   - Verify all IVs are different
5. Verify IV storage:
   - Each IV base64-encoded in envelope
   - IV stored in `envelope.iv` field

**Expected Outcome:**

- Each chunk has unique IV
- Metadata has unique IV
- All IVs are 12 bytes
- IVs are cryptographically random

**Evidence to Capture:**

- IV values from each envelope
- IV uniqueness comparison
- IV length verification

**Pass/Fail Criteria:**

- PASS: All IVs unique, correct length, random
- FAIL: Duplicate IVs or incorrect length

**PDF Requirements Validated:**

- Fresh IV per chunk
- IV uniqueness

---

## TC-ID: FILE-005

**Title:** Metadata Correctness - File Size
**Objective:** Verify file size is correctly stored in encrypted metadata
**Prerequisites:**

- Established session with valid keys
- Test files of various sizes
- Browser console access

**Detailed Steps:**

1. Alice selects file (e.g., 150KB)
2. Monitor metadata creation
3. Verify file size calculation:
   - `fileBuffer.byteLength` = 150KB
   - Size stored in metadata: `size: 150KB`
4. Encrypt metadata
5. Decrypt metadata on receiver side
6. Verify decrypted metadata:
   - `metadata.size` = 150KB
   - Matches original file size

**Expected Outcome:**

- File size correctly stored in metadata
- Size survives encryption/decryption
- Size matches original file

**Evidence to Capture:**

- Original file size
- Encrypted metadata
- Decrypted metadata size
- Size comparison

**Pass/Fail Criteria:**

- PASS: File size correctly stored and recovered
- FAIL: Size mismatch or corruption

**PDF Requirements Validated:**

- Metadata correctness - file size

---

## TC-ID: FILE-006

**Title:** Metadata Correctness - Filename
**Objective:** Verify filename is correctly stored in encrypted metadata
**Prerequisites:**

- Established session with valid keys
- Test file with specific filename
- Browser console access

**Detailed Steps:**

1. Alice selects file (e.g., "document.pdf")
2. Monitor metadata creation
3. Verify filename storage:
   - `file.name` = "document.pdf"
   - Filename stored in metadata: `filename: "document.pdf"`
4. Encrypt metadata
5. Decrypt metadata on receiver side
6. Verify decrypted metadata:
   - `metadata.filename` = "document.pdf"
   - Matches original filename

**Expected Outcome:**

- Filename correctly stored in metadata
- Filename survives encryption/decryption
- Filename matches original

**Evidence to Capture:**

- Original filename
- Encrypted metadata
- Decrypted metadata filename
- Filename comparison

**Pass/Fail Criteria:**

- PASS: Filename correctly stored and recovered
- FAIL: Filename mismatch or corruption

**PDF Requirements Validated:**

- Metadata correctness - filename

---

## TC-ID: FILE-007

**Title:** Metadata Correctness - Chunk Count
**Objective:** Verify totalChunks is correctly calculated and stored
**Prerequisites:**

- Established session with valid keys
- Test files of various sizes
- Browser console access

**Detailed Steps:**

1. Alice selects file (e.g., 500KB)
2. Monitor chunk calculation
3. Verify chunk count calculation:
   - File size = 500KB
   - Chunk size = 256KB
   - `totalChunks = Math.ceil(500KB / 256KB) = 2`
   - Stored in metadata: `totalChunks: 2`
4. Encrypt metadata
5. Verify chunk envelopes:
   - Number of FILE_CHUNK envelopes = 2
   - Each envelope has `meta.totalChunks = 2`
6. Decrypt metadata on receiver side
7. Verify decrypted metadata:
   - `metadata.totalChunks` = 2
   - Matches actual number of chunks

**Expected Outcome:**

- Chunk count correctly calculated
- Chunk count stored in metadata
- Chunk count matches actual chunks
- Chunk count survives encryption/decryption

**Evidence to Capture:**

- File size
- Calculated totalChunks
- Actual chunk count
- Decrypted metadata totalChunks

**Pass/Fail Criteria:**

- PASS: Chunk count correct, stored, and recovered
- FAIL: Chunk count mismatch

**PDF Requirements Validated:**

- Metadata correctness - chunk count

---

## TC-ID: FILE-008

**Title:** Metadata Correctness - MIME Type
**Objective:** Verify MIME type is correctly stored in encrypted metadata
**Prerequisites:**

- Established session with valid keys
- Test files with different MIME types
- Browser console access

**Detailed Steps:**

1. Alice selects file (e.g., "image.png")
2. Monitor metadata creation
3. Verify MIME type storage:
   - `file.type` = "image/png" (or detected)
   - If no type: defaults to "application/octet-stream"
   - Stored in metadata: `mimetype: "image/png"`
4. Encrypt metadata
5. Decrypt metadata on receiver side
6. Verify decrypted metadata:
   - `metadata.mimetype` = "image/png"
   - Matches original MIME type

**Expected Outcome:**

- MIME type correctly stored in metadata
- MIME type survives encryption/decryption
- Default MIME type used if missing

**Evidence to Capture:**

- Original MIME type
- Encrypted metadata
- Decrypted metadata MIME type
- MIME type comparison

**Pass/Fail Criteria:**

- PASS: MIME type correctly stored and recovered
- FAIL: MIME type mismatch or missing

**PDF Requirements Validated:**

- Metadata correctness - MIME type

---

## TC-ID: FILE-009

**Title:** Server Storage - Encrypted Chunks Only
**Objective:** Verify server stores only metadata, not ciphertext
**Prerequisites:**

- Test user sending file
- Access to MongoDB database
- File sent via WebSocket

**Detailed Steps:**

1. Alice sends file (FILE_META + FILE_CHUNK envelopes)
2. Server receives envelopes via `msg:send` event
3. Monitor `MessageMeta` document creation for each envelope
4. Verify FILE_META storage:
   - `messageId`: Present
   - `sessionId`: Present
   - `sender`: Present
   - `receiver`: Present
   - `type`: "FILE_META"
   - `timestamp`: Present
   - `seq`: Present
   - `nonceHash`: Present
   - `meta`: Present (filename, size, totalChunks, mimetype)
5. Verify FILE_CHUNK storage:
   - `messageId`: Present
   - `type`: "FILE_CHUNK"
   - `meta.chunkIndex`: Present
   - `meta.totalChunks`: Present
6. Verify ciphertext NOT stored:
   - Query MongoDB for MessageMeta documents
   - Verify NO `ciphertext` field
   - Verify NO `iv` field
   - Verify NO `authTag` field
   - Verify NO `nonce` field (only `nonceHash`)

**Expected Outcome:**

- Server stores only metadata fields
- Ciphertext, IV, authTag, nonce NOT stored
- Only nonceHash stored (for replay protection)
- File metadata (filename, size, etc.) stored in `meta` field

**Evidence to Capture:**

- MongoDB MessageMeta documents
- Verification of missing ciphertext/iv/authTag fields
- Metadata fields present

**Pass/Fail Criteria:**

- PASS: Only metadata stored, ciphertext not stored
- FAIL: Ciphertext stored or metadata missing

**PDF Requirements Validated:**

- Server stores ONLY metadata
- No ciphertext storage

---

## TC-ID: FILE-010

**Title:** Download Behavior - File Available After Decryption
**Objective:** Verify decrypted file is available for download
**Prerequisites:**

- Established session
- File received and decrypted
- Browser UI access

**Detailed Steps:**

1. Bob receives FILE_META envelope
2. Bob receives all FILE_CHUNK envelopes
3. File decrypted and reconstructed
4. Verify file available in UI:
   - File appears in chat/file list
   - Filename displayed correctly
   - File size displayed correctly
   - Download button/option available
5. Verify download functionality:
   - Click download button
   - File downloads with correct filename
   - File has correct MIME type
   - File size matches original

**Expected Outcome:**

- File available for download after decryption
- Filename, size, MIME type correct
- Download works correctly

**Evidence to Capture:**

- UI file display
- Download button presence
- Downloaded file verification
- File properties (name, size, type)

**Pass/Fail Criteria:**

- PASS: File available, download works, properties correct
- FAIL: File not available or download fails

**PDF Requirements Validated:**

- Download behavior
- File availability after decryption

---

## TC-ID: FILE-011

**Title:** Decryption Behavior - Metadata Decryption
**Objective:** Verify FILE_META envelope is decrypted correctly
**Prerequisites:**

- Established session with valid keys
- FILE_META envelope received
- Browser console access

**Detailed Steps:**

1. Bob receives FILE_META envelope
2. Monitor `decryptFile()` function execution
3. Verify metadata decryption:
   - `recvKey` retrieved from IndexedDB
   - Base64 fields decoded:
     - `ciphertext` → ArrayBuffer
     - `iv` → Uint8Array (12 bytes)
     - `authTag` → ArrayBuffer (16 bytes)
   - `decryptAESGCM()` called with recvKey, iv, ciphertext, authTag
   - Decryption succeeds
4. Verify metadata parsing:
   - Decrypted ArrayBuffer decoded to UTF-8 string
   - JSON parsed: `JSON.parse(metadataJson)`
   - Metadata object extracted: `{filename, size, totalChunks, mimetype}`
5. Verify metadata correctness:
   - All fields present and correct
   - Values match original file

**Expected Outcome:**

- Metadata decrypted successfully
- Metadata parsed correctly
- All fields present and correct

**Evidence to Capture:**

- Decryption function execution
- Decrypted metadata
- Metadata parsing
- Field verification

**Pass/Fail Criteria:**

- PASS: Metadata decrypted and parsed correctly
- FAIL: Decryption fails or metadata incorrect

**PDF Requirements Validated:**

- Decryption behavior - metadata

---

## TC-ID: FILE-012

**Title:** Decryption Behavior - Chunk Decryption
**Objective:** Verify FILE_CHUNK envelopes are decrypted correctly
**Prerequisites:**

- Established session with valid keys
- FILE_CHUNK envelopes received
- Browser console access

**Detailed Steps:**

1. Bob receives FILE_CHUNK envelopes
2. Monitor `decryptFile()` function execution
3. Verify chunk decryption loop:
   - Chunks sorted by `chunkIndex`
   - For each chunk:
     - Base64 fields decoded:
       - `ciphertext` → ArrayBuffer
       - `iv` → Uint8Array (12 bytes)
       - `authTag` → ArrayBuffer (16 bytes)
     - `decryptAESGCM()` called with recvKey, iv, ciphertext, authTag
     - Decryption succeeds
     - Decrypted chunk (ArrayBuffer) added to array
4. Verify all chunks decrypted:
   - Number of decrypted chunks = totalChunks
   - Each chunk is valid ArrayBuffer
   - Chunks in correct order

**Expected Outcome:**

- All chunks decrypted successfully
- Chunks in correct order
- Decrypted chunks are valid ArrayBuffers

**Evidence to Capture:**

- Decryption function execution for each chunk
- Decrypted chunks
- Chunk order verification
- ArrayBuffer validation

**Pass/Fail Criteria:**

- PASS: All chunks decrypted correctly
- FAIL: Decryption fails or chunks incorrect

**PDF Requirements Validated:**

- Decryption behavior - chunks

---

## TC-ID: FILE-013

**Title:** File Reconstruction - Chunk Combination
**Objective:** Verify decrypted chunks are combined into original file
**Prerequisites:**

- Established session with valid keys
- All FILE_CHUNK envelopes received and decrypted
- Browser console access

**Detailed Steps:**

1. Bob receives all FILE_CHUNK envelopes
2. All chunks decrypted
3. Monitor file reconstruction:
   - Calculate total size: `totalSize = sum of all chunk sizes`
   - Create `Uint8Array(totalSize)`
   - For each decrypted chunk:
     - Copy chunk bytes to combined buffer at correct offset
     - `offset += chunk.byteLength`
4. Verify reconstruction:
   - Combined buffer size = original file size
   - Buffer contains all chunk data
   - Data in correct order
5. Verify Blob creation:
   - `new Blob([combinedBuffer], { type: mimetype })`
   - Blob size = original file size
   - Blob type = original MIME type

**Expected Outcome:**

- Chunks combined into single ArrayBuffer
- Combined buffer size matches original
- Blob created with correct MIME type
- File reconstructed correctly

**Evidence to Capture:**

- Combined buffer creation
- Buffer size verification
- Blob creation
- File reconstruction verification

**Pass/Fail Criteria:**

- PASS: File reconstructed correctly, size and type match
- FAIL: Reconstruction fails or size/type mismatch

**PDF Requirements Validated:**

- File reconstruction
- Chunk combination

---

## TC-ID: FILE-014

**Title:** File Reconstruction - Single Chunk File
**Objective:** Verify single-chunk files are reconstructed correctly
**Prerequisites:**

- Established session with valid keys
- Single FILE_CHUNK envelope received
- Browser console access

**Detailed Steps:**

1. Bob receives FILE_META (totalChunks: 1)
2. Bob receives FILE_CHUNK (chunkIndex: 0, totalChunks: 1)
3. File decrypted and reconstructed
4. Verify reconstruction:
   - Single chunk decrypted
   - Combined buffer = decrypted chunk
   - Buffer size = original file size
5. Verify Blob:
   - Blob created from single chunk
   - Blob size = original file size
   - Blob type = original MIME type
6. Verify file integrity:
   - Download file
   - Compare with original
   - Files match byte-for-byte

**Expected Outcome:**

- Single chunk file reconstructed correctly
- File size and type correct
- File integrity maintained

**Evidence to Capture:**

- Reconstruction process
- Blob creation
- File download
- File comparison

**Pass/Fail Criteria:**

- PASS: File reconstructed correctly, integrity maintained
- FAIL: Reconstruction fails or file corrupted

**PDF Requirements Validated:**

- File reconstruction - single chunk

---

## TC-ID: FILE-015

**Title:** File Reconstruction - Multi-Chunk File
**Objective:** Verify multi-chunk files are reconstructed correctly
**Prerequisites:**

- Established session with valid keys
- Multiple FILE_CHUNK envelopes received
- Browser console access

**Detailed Steps:**

1. Bob receives FILE_META (totalChunks: 3)
2. Bob receives FILE_CHUNK envelopes (chunkIndex: 0, 1, 2)
3. File decrypted and reconstructed
4. Verify chunk ordering:
   - Chunks sorted by `chunkIndex`
   - Chunk 0 decrypted first
   - Chunk 1 decrypted second
   - Chunk 2 decrypted third
5. Verify reconstruction:
   - Chunk 0 bytes at offset 0
   - Chunk 1 bytes at offset chunk0.size
   - Chunk 2 bytes at offset chunk0.size + chunk1.size
   - Combined buffer size = sum of all chunks
6. Verify file integrity:
   - Download file
   - Compare with original
   - Files match byte-for-byte

**Expected Outcome:**

- Multi-chunk file reconstructed correctly
- Chunks in correct order
- File integrity maintained

**Evidence to Capture:**

- Chunk ordering
- Reconstruction process
- File download
- File comparison

**Pass/Fail Criteria:**

- PASS: File reconstructed correctly, integrity maintained
- FAIL: Reconstruction fails, wrong order, or file corrupted

**PDF Requirements Validated:**

- File reconstruction - multi-chunk

---

## TC-ID: FILE-016

**Title:** Replay Attempt on File Chunks - Duplicate Chunk
**Objective:** Verify duplicate FILE_CHUNK envelope is rejected
**Prerequisites:**

- Established session
- FILE_CHUNK envelope already processed
- Browser console access

**Detailed Steps:**

1. Bob receives FILE_CHUNK with seq=10, chunkIndex=0
2. Bob processes chunk successfully
3. Attacker replays same FILE_CHUNK envelope (seq=10, chunkIndex=0)
4. Bob receives replayed envelope
5. Verify replay detection:
   - Timestamp validation (if stale, reject)
   - Sequence validation: `envelope.seq <= lastSeq` → REJECT
   - Nonce validation: duplicate nonce → REJECT
6. Verify rejection:
   - Message rejected
   - Error logged
   - Chunk not decrypted
   - File reconstruction not affected

**Expected Outcome:**

- Duplicate chunk rejected
- Replay detected and logged
- File reconstruction continues with valid chunks only

**Evidence to Capture:**

- Replay attempt
- Rejection reason
- Log entry
- File reconstruction status

**Pass/Fail Criteria:**

- PASS: Duplicate chunk rejected, replay logged
- FAIL: Duplicate chunk accepted or not logged

**PDF Requirements Validated:**

- Replay attempt on file chunks
- Duplicate detection

---

## TC-ID: FILE-017

**Title:** Replay Attempt on File Chunks - Stale Timestamp
**Objective:** Verify FILE_CHUNK with stale timestamp is rejected
**Prerequisites:**

- Established session
- FILE_CHUNK envelope with old timestamp
- Browser console access

**Detailed Steps:**

1. Create FILE_CHUNK envelope with timestamp = 3 minutes ago
2. Bob receives envelope
3. Verify timestamp validation:
   - `age = Date.now() - envelope.timestamp`
   - `|age| > 120000` (2 minutes) → REJECT
4. Verify rejection:
   - Message rejected: "Timestamp out of validity window"
   - Error logged
   - Chunk not decrypted
   - File reconstruction not affected

**Expected Outcome:**

- Stale chunk rejected
- Timestamp failure logged
- File reconstruction continues

**Evidence to Capture:**

- Timestamp validation
- Rejection reason
- Log entry
- File reconstruction status

**Pass/Fail Criteria:**

- PASS: Stale chunk rejected, timestamp failure logged
- FAIL: Stale chunk accepted or not logged

**PDF Requirements Validated:**

- Replay attempt on file chunks
- Timestamp validation

---

## TC-ID: FILE-018

**Title:** Error Case - Wrong Key for Decryption
**Objective:** Verify decryption fails with wrong key
**Prerequisites:**

- Established session
- FILE_META or FILE_CHUNK envelope received
- Ability to use wrong key

**Detailed Steps:**

1. Bob receives FILE_META envelope
2. Attempt decryption with wrong key:
   - Use different session's recvKey
   - Or use corrupted key
3. Verify decryption failure:
   - `decryptAESGCM()` called with wrong key
   - Decryption throws `OperationError`
   - Error: "Authentication tag verification failed"
4. Verify error handling:
   - Error caught and logged
   - User-friendly error message returned
   - File reconstruction fails
   - No partial file created

**Expected Outcome:**

- Decryption fails with wrong key
- Authentication tag verification fails
- Error logged and reported
- No partial file created

**Evidence to Capture:**

- Decryption attempt with wrong key
- Error thrown
- Error log
- File reconstruction status

**Pass/Fail Criteria:**

- PASS: Decryption fails correctly, error logged
- FAIL: Decryption succeeds with wrong key or error not logged

**PDF Requirements Validated:**

- Error case - wrong key
- Authentication tag verification

---

## TC-ID: FILE-019

**Title:** Error Case - Chunk Mismatch - Missing Chunk
**Objective:** Verify error when chunk count doesn't match
**Prerequisites:**

- Established session
- FILE_META received (totalChunks: 3)
- Only 2 FILE_CHUNK envelopes received

**Detailed Steps:**

1. Bob receives FILE_META (totalChunks: 3)
2. Bob receives FILE_CHUNK (chunkIndex: 0)
3. Bob receives FILE_CHUNK (chunkIndex: 1)
4. Bob attempts file reconstruction
5. Verify error detection:
   - `sortedChunks.length = 2`
   - `totalChunks = 3`
   - `sortedChunks.length !== totalChunks` → ERROR
6. Verify error:
   - Error thrown: "Missing chunks: expected 3, got 2"
   - Error logged
   - File reconstruction fails
   - No partial file created

**Expected Outcome:**

- Missing chunk detected
- Error thrown and logged
- File reconstruction fails
- No partial file created

**Evidence to Capture:**

- Chunk count mismatch
- Error thrown
- Error log
- File reconstruction status

**Pass/Fail Criteria:**

- PASS: Missing chunk detected, error logged
- FAIL: Missing chunk not detected or error not logged

**PDF Requirements Validated:**

- Error case - chunk mismatch
- Missing chunk detection

---

## TC-ID: FILE-020

**Title:** Error Case - Chunk Mismatch - Wrong Index
**Objective:** Verify error when chunk index doesn't match expected
**Prerequisites:**

- Established session
- FILE_META received (totalChunks: 3)
- FILE_CHUNK with wrong chunkIndex

**Detailed Steps:**

1. Bob receives FILE_META (totalChunks: 3)
2. Bob receives FILE_CHUNK (chunkIndex: 0) ✓
3. Bob receives FILE_CHUNK (chunkIndex: 2) ✗ (missing chunkIndex: 1)
4. Bob receives FILE_CHUNK (chunkIndex: 1) (out of order)
5. Bob attempts file reconstruction
6. Verify error detection:
   - Chunks sorted: [0, 1, 2]
   - Loop: `i = 0`, `chunkEnvelope.meta.chunkIndex = 0` ✓
   - Loop: `i = 1`, `chunkEnvelope.meta.chunkIndex = 1` ✓
   - Loop: `i = 2`, `chunkEnvelope.meta.chunkIndex = 2` ✓
   - If mismatch: `chunkEnvelope.meta.chunkIndex !== i` → ERROR
7. Verify error:
   - Error thrown: "Chunk index mismatch: expected X, got Y"
   - Error logged
   - File reconstruction fails

**Expected Outcome:**

- Chunk index mismatch detected
- Error thrown and logged
- File reconstruction fails

**Evidence to Capture:**

- Chunk index verification
- Error thrown
- Error log
- File reconstruction status

**Pass/Fail Criteria:**

- PASS: Chunk index mismatch detected, error logged
- FAIL: Mismatch not detected or error not logged

**PDF Requirements Validated:**

- Error case - chunk mismatch
- Index validation

---

## TC-ID: FILE-021

**Title:** Error Case - Tampered Ciphertext
**Objective:** Verify decryption fails when ciphertext is tampered
**Prerequisites:**

- Established session
- FILE_CHUNK envelope received
- Ability to tamper with ciphertext

**Detailed Steps:**

1. Bob receives FILE_CHUNK envelope
2. Tamper with ciphertext:
   - Modify base64-encoded ciphertext
   - Or corrupt ciphertext bytes
3. Attempt decryption:
   - Base64 decode tampered ciphertext
   - Call `decryptAESGCM()` with tampered ciphertext
4. Verify decryption failure:
   - Decryption throws `OperationError`
   - Error: "Authentication tag verification failed"
   - AuthTag verification fails (ciphertext tampered)
5. Verify error handling:
   - Error caught and logged
   - User-friendly error message returned
   - Chunk not decrypted
   - File reconstruction fails

**Expected Outcome:**

- Decryption fails with tampered ciphertext
- Authentication tag verification fails
- Error logged and reported
- No partial file created

**Evidence to Capture:**

- Tampered ciphertext
- Decryption attempt
- Error thrown
- Error log

**Pass/Fail Criteria:**

- PASS: Decryption fails correctly, error logged
- FAIL: Decryption succeeds with tampered ciphertext or error not logged

**PDF Requirements Validated:**

- Error case - tampered ciphertext
- Authentication tag verification

---

## TC-ID: FILE-022

**Title:** Error Case - Tampered AuthTag
**Objective:** Verify decryption fails when authTag is tampered
**Prerequisites:**

- Established session
- FILE_CHUNK envelope received
- Ability to tamper with authTag

**Detailed Steps:**

1. Bob receives FILE_CHUNK envelope
2. Tamper with authTag:
   - Modify base64-encoded authTag
   - Or corrupt authTag bytes
3. Attempt decryption:
   - Base64 decode tampered authTag
   - Call `decryptAESGCM()` with tampered authTag
4. Verify decryption failure:
   - Decryption throws `OperationError`
   - Error: "Authentication tag verification failed"
   - AuthTag verification fails (tag tampered)
5. Verify error handling:
   - Error caught and logged
   - User-friendly error message returned
   - Chunk not decrypted
   - File reconstruction fails

**Expected Outcome:**

- Decryption fails with tampered authTag
- Authentication tag verification fails
- Error logged and reported
- No partial file created

**Evidence to Capture:**

- Tampered authTag
- Decryption attempt
- Error thrown
- Error log

**Pass/Fail Criteria:**

- PASS: Decryption fails correctly, error logged
- FAIL: Decryption succeeds with tampered authTag or error not logged

**PDF Requirements Validated:**

- Error case - tampered authTag
- Authentication tag verification

---

## TC-ID: FILE-023

**Title:** Logging of File-Related Failures - Decryption Error
**Objective:** Verify file decryption errors are logged
**Prerequisites:**

- Established session
- File decryption failure scenario
- Access to client logs

**Detailed Steps:**

1. Bob attempts to decrypt file with wrong key
2. Decryption fails
3. Verify error logging:
   - Check client-side logs
   - Error logged: "Failed to decrypt file: [error message]"
   - Console error: `console.error('Failed to decrypt file:', error)`
4. Verify log entry contains:
   - Error message
   - File metadata (if available)
   - Session ID
   - Timestamp

**Expected Outcome:**

- Decryption error logged
- Log entry contains error details
- Log accessible for debugging

**Evidence to Capture:**

- Log entry
- Error message
- Log format verification

**Pass/Fail Criteria:**

- PASS: Error logged with details
- FAIL: Error not logged or missing details

**PDF Requirements Validated:**

- Logging of file-related failures
- Decryption error logging

---

## TC-ID: FILE-024

**Title:** Logging of File-Related Failures - Missing Chunk Error
**Objective:** Verify missing chunk errors are logged
**Prerequisites:**

- Established session
- Missing chunk scenario
- Access to client logs

**Detailed Steps:**

1. Bob receives FILE_META (totalChunks: 3)
2. Bob receives only 2 FILE_CHUNK envelopes
3. Bob attempts file reconstruction
4. Missing chunk error thrown
5. Verify error logging:
   - Check client-side logs
   - Error logged: "Missing chunks: expected 3, got 2"
   - Console error logged
6. Verify log entry contains:
   - Error message
   - Expected chunk count
   - Actual chunk count
   - Session ID

**Expected Outcome:**

- Missing chunk error logged
- Log entry contains chunk count details
- Log accessible for debugging

**Evidence to Capture:**

- Log entry
- Error message
- Chunk count details

**Pass/Fail Criteria:**

- PASS: Error logged with chunk count details
- FAIL: Error not logged or missing details

**PDF Requirements Validated:**

- Logging of file-related failures
- Missing chunk error logging

---

## TC-ID: FILE-025

**Title:** Logging of File-Related Failures - Server-Side File Chunk Forwarding
**Objective:** Verify server logs file chunk forwarding
**Prerequisites:**

- Test user sending file
- Access to server logs
- File sent via WebSocket

**Detailed Steps:**

1. Alice sends FILE_CHUNK envelope
2. Server receives and forwards to Bob
3. Verify server logging:
   - Check `file_chunk_forwarding.log`
   - Log entry created
4. Verify log entry contains:
   - `timestamp`: ISO timestamp
   - `senderId`: Alice's user ID
   - `receiverId`: Bob's user ID
   - `sessionId`: Session identifier
   - `chunkIndex`: Chunk index number
   - `type`: "file_chunk_forwarding"
5. Verify log format:
   - JSON format
   - All fields present
   - Log entry appended to file

**Expected Outcome:**

- File chunk forwarding logged
- Log entry contains all required fields
- Log format correct

**Evidence to Capture:**

- Log entry from file_chunk_forwarding.log
- Field verification
- Log format verification

**Pass/Fail Criteria:**

- PASS: Logging works, all fields present
- FAIL: Not logged or missing fields

**PDF Requirements Validated:**

- Logging of file-related failures
- Server-side file chunk forwarding logging

---

## TC-ID: FILE-026

**Title:** File Size Validation - Maximum Size Limit
**Objective:** Verify files exceeding maximum size are rejected
**Prerequisites:**

- Established session
- Test file > 100MB
- Browser console access

**Detailed Steps:**

1. Alice selects file (e.g., 150MB)
2. Monitor `encryptFile()` function execution
3. Verify file size validation:
   - `fileSize = 150MB`
   - `MAX_FILE_SIZE = 100MB`
   - `fileSize > MAX_FILE_SIZE` → ERROR
4. Verify error:
   - Error thrown: "File size (150.00 MB) exceeds maximum allowed size (100 MB)"
   - Error logged
   - File encryption fails
   - No envelopes created

**Expected Outcome:**

- File exceeding maximum size rejected
- Error thrown and logged
- No encryption attempted

**Evidence to Capture:**

- File size validation
- Error thrown
- Error log
- Encryption status

**Pass/Fail Criteria:**

- PASS: Large file rejected, error logged
- FAIL: Large file accepted or error not logged

**PDF Requirements Validated:**

- File size validation
- Maximum size limit enforcement

---

## TC-ID: FILE-027

**Title:** File Size Validation - Valid Size
**Objective:** Verify files within size limit are accepted
**Prerequisites:**

- Established session
- Test file < 100MB
- Browser console access

**Detailed Steps:**

1. Alice selects file (e.g., 50MB)
2. Monitor `encryptFile()` function execution
3. Verify file size validation:
   - `fileSize = 50MB`
   - `MAX_FILE_SIZE = 100MB`
   - `fileSize <= MAX_FILE_SIZE` → ACCEPT
4. Verify encryption proceeds:
   - File size validation passes
   - File encryption continues
   - Envelopes created successfully

**Expected Outcome:**

- File within size limit accepted
- Encryption proceeds normally
- Envelopes created

**Evidence to Capture:**

- File size validation
- Encryption success
- Envelope creation

**Pass/Fail Criteria:**

- PASS: Valid file accepted and encrypted
- FAIL: Valid file rejected or encryption fails

**PDF Requirements Validated:**

- File size validation
- Valid size acceptance

---

## TC-ID: FILE-028

**Title:** Memory Security - Plaintext Clearing After Encryption
**Objective:** Verify plaintext is cleared from memory after file encryption
**Prerequisites:**

- Established session
- Test file
- Memory monitoring capability

**Detailed Steps:**

1. Alice selects file
2. File read as ArrayBuffer
3. File encrypted
4. Verify memory clearing:
   - Monitor `clearPlaintextAfterEncryption()` calls
   - File buffer cleared after encryption
   - Chunk buffers cleared after encryption
5. Verify plaintext not retained:
   - No plaintext in memory after encryption
   - Only ciphertext and envelopes remain

**Expected Outcome:**

- Plaintext cleared from memory after encryption
- Memory security maintained
- No plaintext leaks

**Evidence to Capture:**

- Memory clearing function calls
- Memory state verification
- Plaintext absence confirmation

**Pass/Fail Criteria:**

- PASS: Plaintext cleared, memory secure
- FAIL: Plaintext retained in memory

**PDF Requirements Validated:**

- Memory security
- Plaintext clearing after encryption

---

## TC-ID: FILE-029

**Title:** Memory Security - Plaintext Clearing After Decryption
**Objective:** Verify plaintext is cleared from memory after file decryption
**Prerequisites:**

- Established session
- File received and decrypted
- Memory monitoring capability

**Detailed Steps:**

1. Bob receives and decrypts file
2. File reconstructed into Blob
3. Verify memory clearing:
   - Monitor `clearPlaintextAfterDecryption()` calls
   - Decrypted chunks cleared after blob creation
   - Combined buffer cleared
   - Decrypted metadata cleared
4. Verify plaintext not retained:
   - No plaintext chunks in memory after blob creation
   - Only Blob object remains

**Expected Outcome:**

- Plaintext cleared from memory after decryption
- Memory security maintained
- Blob available for download

**Evidence to Capture:**

- Memory clearing function calls
- Memory state verification
- Plaintext absence confirmation

**Pass/Fail Criteria:**

- PASS: Plaintext cleared, memory secure, blob available
- FAIL: Plaintext retained in memory

**PDF Requirements Validated:**

- Memory security
- Plaintext clearing after decryption

---

## TC-ID: FILE-030

**Title:** File Reconstruction - Out-of-Order Chunk Delivery
**Objective:** Verify file reconstruction handles out-of-order chunk delivery
**Prerequisites:**

- Established session
- FILE_META received
- FILE_CHUNK envelopes received out of order

**Detailed Steps:**

1. Bob receives FILE_META (totalChunks: 3)
2. Bob receives FILE_CHUNK (chunkIndex: 2) first
3. Bob receives FILE_CHUNK (chunkIndex: 0) second
4. Bob receives FILE_CHUNK (chunkIndex: 1) third
5. Verify chunk handling:
   - Chunks stored as received
   - Chunks sorted by `chunkIndex` before decryption
   - Sorted order: [0, 1, 2]
6. Verify reconstruction:
   - Chunks decrypted in sorted order
   - File reconstructed correctly
   - File integrity maintained

**Expected Outcome:**

- Out-of-order chunks handled correctly
- Chunks sorted before decryption
- File reconstructed correctly

**Evidence to Capture:**

- Chunk receipt order
- Chunk sorting
- File reconstruction
- File integrity verification

**Pass/Fail Criteria:**

- PASS: Out-of-order chunks handled, file reconstructed correctly
- FAIL: Chunks not sorted or file corrupted

**PDF Requirements Validated:**

- File reconstruction
- Out-of-order chunk handling

---

**End of File Encryption Testcase Suite**
