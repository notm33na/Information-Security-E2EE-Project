#!/usr/bin/env node
/**
 * Test Runner Script
 * Runs all E2EE test suites and reports results
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testSuites = [
  { name: 'Key Generation', script: 'test:e2e:keys' },
  { name: 'Session Establishment', script: 'test:e2e:session' },
  { name: 'Message Encrypt/Decrypt', script: 'test:e2e:encrypt' },
  { name: 'Message Flow', script: 'test:e2e:messages' },
  { name: 'File Encryption', script: 'test:e2e:files' },
  { name: 'Key Rotation', script: 'test:e2e:rotation' },
  { name: 'Corrupted Envelope Attack', script: 'test:attack:corrupted' },
  { name: 'Replay Attack', script: 'test:attack:replay' },
  { name: 'MITM Attack', script: 'test:attack:mitm' },
];

const results = [];

console.log('🧪 Running E2EE Test Suites...\n');

for (const suite of testSuites) {
  console.log(`\n📋 Running: ${suite.name}`);
  console.log('─'.repeat(50));
  
  try {
    const startTime = Date.now();
    const output = execSync(`npm run ${suite.script}`, {
      cwd: __dirname,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 300000, // 5 minutes per suite
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Check if tests passed
    const passed = output.includes('Test Suites:') && 
                   !output.includes('FAIL') && 
                   output.match(/Tests:\s+(\d+)\s+passed/);
    
    if (passed) {
      const match = output.match(/Tests:\s+(\d+)\s+passed/);
      const testCount = match ? match[1] : '?';
      console.log(`✅ PASSED: ${testCount} tests (${duration}s)`);
      results.push({ name: suite.name, status: 'PASSED', duration, testCount });
    } else {
      console.log(`❌ FAILED (${duration}s)`);
      results.push({ name: suite.name, status: 'FAILED', duration });
    }
  } catch (error) {
    const duration = error.signal === 'SIGTERM' ? 'TIMEOUT' : 'ERROR';
    console.log(`❌ FAILED: ${error.message || duration}`);
    results.push({ name: suite.name, status: 'FAILED', duration });
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(50));

const passed = results.filter(r => r.status === 'PASSED').length;
const failed = results.filter(r => r.status === 'FAILED').length;

results.forEach(result => {
  const icon = result.status === 'PASSED' ? '✅' : '❌';
  console.log(`${icon} ${result.name.padEnd(30)} ${result.status} ${result.duration ? `(${result.duration}s)` : ''}`);
});

console.log('\n' + '='.repeat(50));
console.log(`Total: ${results.length} suites | Passed: ${passed} | Failed: ${failed}`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);

