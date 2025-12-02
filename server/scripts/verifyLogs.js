#!/usr/bin/env node

/**
 * Log Verification Script
 * 
 * Verifies the structure and integrity of log files.
 * 
 * Usage:
 *   node scripts/verifyLogs.js --file=logs/security-2025-01-02.log
 *   node scripts/verifyLogs.js --file=logs/replay_attempts.log
 *   node scripts/verifyLogs.js --dir=logs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyLogEntry } from '../src/utils/logIntegrity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Required fields for different log types
const REQUIRED_FIELDS = {
  'REPLAY_ATTEMPT': ['timestamp', 'eventType', 'sessionId', 'seq', 'reason'],
  'INVALID_SIGNATURE': ['timestamp', 'eventType', 'sessionId', 'userId', 'messageType', 'reason'],
  'AUTH_ATTEMPT': ['timestamp', 'eventType', 'userId', 'success', 'reason'],
  'KEY_EXCHANGE': ['timestamp', 'eventType', 'sessionId', 'fromUserId', 'toUserId', 'messageType'],
  'DECRYPTION_FAILED': ['timestamp', 'eventType', 'sessionId', 'userId', 'seq', 'reason'],
  'INVALID_KEP_MESSAGE': ['timestamp', 'eventType', 'sessionId', 'userId', 'reason'],
  'METADATA_ACCESS': ['timestamp', 'eventType', 'sessionId', 'userId', 'action'],
  'key_rotation': ['timestamp', 'event', 'userId', 'sessionId'],
  'AUTH_FAILURE_THRESHOLD': ['timestamp', 'eventType', 'attemptCount', 'threshold'],
  'REPLAY_ATTEMPT_THRESHOLD': ['timestamp', 'eventType', 'ip', 'attemptCount', 'threshold'],
  'SIGNATURE_FAILURE_THRESHOLD': ['timestamp', 'eventType', 'userId', 'failureCount', 'threshold']
};

/**
 * Validates log entry structure
 * @param {Object} entry - Parsed log entry
 * @param {string} eventType - Event type
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateLogEntryStructure(entry, eventType) {
  const errors = [];
  const required = REQUIRED_FIELDS[eventType] || ['timestamp', 'eventType'];

  // Check required fields
  for (const field of required) {
    if (!(field in entry) || entry[field] === null || entry[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate timestamp format (ISO 8601)
  if (entry.timestamp) {
    const timestamp = new Date(entry.timestamp);
    if (isNaN(timestamp.getTime())) {
      errors.push(`Invalid timestamp format: ${entry.timestamp}`);
    }
  }

  // Validate eventType matches
  if (entry.eventType && entry.eventType !== eventType && entry.event !== eventType) {
    // Allow 'event' field as alternative to 'eventType'
    if (entry.event !== eventType) {
      errors.push(`Event type mismatch: expected ${eventType}, got ${entry.eventType || entry.event}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Verifies a single log file
 * @param {string} filePath - Path to log file
 * @returns {Promise<{valid: number, invalid: number, tampered: number, errors: Array}>}
 */
async function verifyLogFile(filePath) {
  const results = {
    valid: 0,
    invalid: 0,
    tampered: 0,
    errors: []
  };

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      try {
        // Verify HMAC integrity
        const verifyResult = verifyLogEntry(line);

        if (!verifyResult.valid) {
          results.tampered++;
          results.errors.push({
            line: lineNum,
            error: verifyResult.error || 'HMAC verification failed',
            entry: null
          });
          continue;
        }

        const entry = verifyResult.entry;
        const eventType = entry.eventType || entry.event;

        if (!eventType) {
          results.invalid++;
          results.errors.push({
            line: lineNum,
            error: 'Missing eventType/event field',
            entry
          });
          continue;
        }

        // Validate structure
        const structureCheck = validateLogEntryStructure(entry, eventType);
        if (!structureCheck.valid) {
          results.invalid++;
          results.errors.push({
            line: lineNum,
            error: `Structure validation failed: ${structureCheck.errors.join(', ')}`,
            entry
          });
          continue;
        }

        results.valid++;
      } catch (error) {
        results.invalid++;
        results.errors.push({
          line: lineNum,
          error: error.message,
          entry: null
        });
      }
    }
  } catch (error) {
    throw new Error(`Failed to read log file: ${error.message}`);
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let filePath = null;
  let dirPath = null;

  // Parse arguments
  for (const arg of args) {
    if (arg.startsWith('--file=')) {
      filePath = arg.substring(7);
    } else if (arg.startsWith('--dir=')) {
      dirPath = arg.substring(6);
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Log Verification Script

Usage:
  node scripts/verifyLogs.js --file=<log-file-path>
  node scripts/verifyLogs.js --dir=<logs-directory>

Options:
  --file=<path>    Verify a specific log file
  --dir=<path>     Verify all log files in a directory
  --help, -h       Show this help message

Examples:
  node scripts/verifyLogs.js --file=logs/security-2025-01-02.log
  node scripts/verifyLogs.js --file=logs/replay_attempts.log
  node scripts/verifyLogs.js --dir=logs
      `);
      process.exit(0);
    }
  }

  if (!filePath && !dirPath) {
    console.error('Error: Must specify --file or --dir');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  try {
    if (filePath) {
      // Verify single file
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      
      if (!fs.existsSync(absolutePath)) {
        console.error(`Error: File not found: ${absolutePath}`);
        process.exit(1);
      }

      console.log(`Verifying log file: ${absolutePath}\n`);
      const results = await verifyLogFile(absolutePath);
      printResults(absolutePath, results);
    } else if (dirPath) {
      // Verify all log files in directory
      const absoluteDir = path.isAbsolute(dirPath) ? dirPath : path.join(process.cwd(), dirPath);
      
      if (!fs.existsSync(absoluteDir)) {
        console.error(`Error: Directory not found: ${absoluteDir}`);
        process.exit(1);
      }

      const files = fs.readdirSync(absoluteDir)
        .filter(file => file.endsWith('.log'))
        .map(file => path.join(absoluteDir, file));

      if (files.length === 0) {
        console.log(`No log files found in: ${absoluteDir}`);
        process.exit(0);
      }

      console.log(`Verifying ${files.length} log file(s) in: ${absoluteDir}\n`);

      let totalValid = 0;
      let totalInvalid = 0;
      let totalTampered = 0;

      for (const file of files) {
        const results = await verifyLogFile(file);
        printResults(file, results);
        totalValid += results.valid;
        totalInvalid += results.invalid;
        totalTampered += results.tampered;
        console.log('');
      }

      // Print summary
      const total = totalValid + totalInvalid + totalTampered;
      const integrityScore = total > 0 ? ((totalValid / total) * 100).toFixed(2) : 0;
      
      console.log('='.repeat(60));
      console.log('SUMMARY');
      console.log('='.repeat(60));
      console.log(`Total entries: ${total}`);
      console.log(`Valid: ${totalValid}`);
      console.log(`Invalid/Tampered: ${totalInvalid + totalTampered}`);
      console.log(`Integrity Score: ${integrityScore}%`);
      console.log('='.repeat(60));
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Prints verification results
 * @param {string} filePath - File path
 * @param {Object} results - Verification results
 */
function printResults(filePath, results) {
  const filename = path.basename(filePath);
  const total = results.valid + results.invalid + results.tampered;
  const integrityScore = total > 0 ? ((results.valid / total) * 100).toFixed(2) : 0;

  console.log(`File: ${filename}`);
  console.log(`Valid: ${results.valid}/${total}`);
  console.log(`Invalid/Tampered: ${results.invalid + results.tampered}/${total}`);
  console.log(`Integrity Score: ${integrityScore}%`);

  if (results.errors.length > 0 && results.errors.length <= 10) {
    console.log('\nErrors:');
    for (const err of results.errors) {
      console.log(`  Line ${err.line}: ${err.error}`);
    }
  } else if (results.errors.length > 10) {
    console.log(`\nFirst 10 errors (${results.errors.length} total):`);
    for (const err of results.errors.slice(0, 10)) {
      console.log(`  Line ${err.line}: ${err.error}`);
    }
  }
}

// Run main function
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

