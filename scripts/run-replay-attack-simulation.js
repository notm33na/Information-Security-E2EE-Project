#!/usr/bin/env node

/**
 * Automated Replay Attack Simulation Script
 * 
 * This script automates the entire replay attack simulation process:
 * 1. Login (or use existing token)
 * 2. Enable attack mode
 * 3. Wait for/capture messages
 * 4. Run attack simulations
 * 5. Display results
 * 
 * Usage:
 *   node scripts/run-replay-attack-simulation.js [options]
 * 
 * Options:
 *   --email <email>        Login email (required if no token)
 *   --password <password>  Login password (required if no token)
 *   --token <token>        Use existing token (skip login)
 *   --session <sessionId>  Specific session to attack (optional)
 *   --attack-type <type>   Attack type: exact, stale-timestamp, duplicate-nonce, out-of-order-seq (default: exact)
 *   --wait <seconds>       Wait time for messages to be captured (default: 10)
 *   --skip-enable          Skip enabling attack mode (assume already enabled)
 */

import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
// Support network IPs - check for API_URL env var or use localhost
// If running on network, set API_URL=https://192.168.56.1:8443 or similar
const API_BASE = process.env.API_URL || 'https://localhost:8443';
// Default to insecure for self-signed certificates (development)
const INSECURE = process.env.INSECURE !== 'false' && (process.env.INSECURE === 'true' || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || true);

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  email: null,
  password: null,
  token: null,
  sessionId: null,
  attackType: 'exact',
  waitTime: 10,
  skipEnable: false
};

// Parse arguments
// Also support positional arguments for convenience: email password
let positionalArgs = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--email' && args[i + 1]) {
    config.email = args[++i];
  } else if (arg === '--password' && args[i + 1]) {
    config.password = args[++i];
  } else if (arg === '--token' && args[i + 1]) {
    config.token = args[++i];
  } else if (arg === '--session' && args[i + 1]) {
    config.sessionId = args[++i];
  } else if (arg === '--attack-type' && args[i + 1]) {
    config.attackType = args[++i];
  } else if (arg === '--wait' && args[i + 1]) {
    config.waitTime = parseInt(args[++i], 10);
  } else if (arg === '--skip-enable') {
    config.skipEnable = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Automated Replay Attack Simulation Script

Usage:
  node scripts/run-replay-attack-simulation.js [options]

Options:
  --email <email>          Login email (required if no token)
  --password <password>    Login password (required if no token)
  --token <token>          Use existing token (skip login)
  --session <sessionId>    Specific session to attack (optional, auto-detects if not provided)
  --attack-type <type>     Attack type: exact, stale-timestamp, duplicate-nonce, out-of-order-seq (default: exact)
  --wait <seconds>         Wait time for messages to be captured (default: 10)
  --skip-enable            Skip enabling attack mode (assume already enabled)
  --help, -h               Show this help message

Examples:
  # Login and run exact replay attack
  node scripts/run-replay-attack-simulation.js --email test@example.com --password Test123!@#

  # Use existing token
  node scripts/run-replay-attack-simulation.js --token YOUR_TOKEN

  # Run stale timestamp attack on specific session
  node scripts/run-replay-attack-simulation.js --token YOUR_TOKEN --session session-123 --attack-type stale-timestamp
`);
    process.exit(0);
  } else if (!arg.startsWith('--')) {
    // Positional argument (not a flag)
    positionalArgs.push(arg);
  }
}

// Colors for output (define early so log function works)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Handle positional arguments as fallback (email password)
if (!config.email && !config.token && positionalArgs.length >= 2) {
  config.email = positionalArgs[0];
  config.password = positionalArgs[1];
  log('⚠️  Using positional arguments (email, password). For clarity, use --email and --password flags.', 'yellow');
}

// HTTPS agent that ignores certificate errors (for development)
const httpsAgent = new https.Agent({
  rejectUnauthorized: !INSECURE
});

function makeRequest(method, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || 8443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      agent: httpsAgent
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${json.error || json.message || data}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function login(email, password) {
  log('🔐 Logging in...', 'cyan');
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      body: { email, password }
    });
    
    if (response.success && response.data.accessToken) {
      log('✅ Login successful!', 'green');
      return response.data.accessToken;
    }
    throw new Error('Login failed: No token received');
  } catch (error) {
    log(`❌ Login failed: ${error.message}`, 'red');
    throw error;
  }
}

async function enableAttackMode(token) {
  log('⚙️  Enabling attack mode...', 'cyan');
  try {
    const response = await makeRequest('POST', '/api/replay-attack/toggle', {
      headers: { Authorization: `Bearer ${token}` },
      body: { enabled: true }
    });
    
    if (response.success) {
      log('✅ Attack mode enabled!', 'green');
      return true;
    }
    throw new Error('Failed to enable attack mode');
  } catch (error) {
    log(`❌ Failed to enable attack mode: ${error.message}`, 'red');
    throw error;
  }
}

async function getAttackStatus(token) {
  try {
    const response = await makeRequest('GET', '/api/replay-attack/status');
    return response.data;
  } catch (error) {
    return null;
  }
}

async function getCapturedMessages(token, sessionId = null) {
  const path = sessionId ? `/api/replay-attack/captured/${sessionId}` : '/api/replay-attack/captured/all';
  try {
    const response = await makeRequest('GET', path, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    log(`⚠️  Failed to get captured messages: ${error.message}`, 'yellow');
    return null;
  }
}

async function waitForMessages(token, waitTime, sessionId = null) {
  log(`⏳ Waiting ${waitTime} seconds for messages to be captured...`, 'yellow');
  log('   (Send some messages in the application during this time)', 'yellow');
  
  for (let i = waitTime; i > 0; i--) {
    process.stdout.write(`\r   ${i} seconds remaining...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.stdout.write('\r   Done!                    \n');
}

async function runAttackSimulation(token, sessionId, messageId, attackType) {
  log(`🚀 Running ${attackType} attack simulation...`, 'cyan');
  log(`   Session: ${sessionId}`, 'blue');
  log(`   Message: ${messageId}`, 'blue');
  
  const endpoint = `/api/replay-attack/simulate/${attackType}`;
  const body = { sessionId, messageId };
  
  // Add ageMinutes for stale-timestamp
  if (attackType === 'stale-timestamp') {
    body.ageMinutes = 3;
  }
  
  try {
    const response = await makeRequest('POST', endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      body
    });
    
    return response.data;
  } catch (error) {
    log(`❌ Attack simulation failed: ${error.message}`, 'red');
    throw error;
  }
}

function displayAttackResults(result) {
  log('\n' + '='.repeat(60), 'bright');
  log('ATTACK SIMULATION RESULTS', 'bright');
  log('='.repeat(60), 'bright');
  
  log(`\n📋 Attack ID: ${result.attackId}`, 'cyan');
  log(`📋 Attack Type: ${result.flow?.attackType || 'N/A'}`, 'cyan');
  log(`📋 Session ID: ${result.flow?.sessionId || 'N/A'}`, 'cyan');
  
  log(`\n🎯 Result:`, 'bright');
  if (result.blocked) {
    log(`   ❌ BLOCKED`, 'red');
    log(`   Reason: ${result.reason}`, 'yellow');
    log(`   Protection: ${result.protection}`, 'green');
  } else if (result.success) {
    log(`   ⚠️  Would Succeed (simulation only)`, 'yellow');
    log(`   Note: ${result.reason}`, 'yellow');
  } else {
    log(`   ❌ Failed`, 'red');
    log(`   Reason: ${result.reason}`, 'yellow');
  }
  
  if (result.flow) {
    log(`\n📊 Attack Flow:`, 'bright');
    log(`   Duration: ${result.flow.duration}ms`, 'cyan');
    log(`   Steps: ${result.flow.steps?.length || 0}`, 'cyan');
    
    if (result.flow.steps && result.flow.steps.length > 0) {
      log(`\n📝 Step-by-Step:`, 'bright');
      result.flow.steps.forEach((step, index) => {
        const stepNum = typeof step.step === 'number' ? step.step : index + 1;
        log(`   ${stepNum}. ${step.description}`, 'blue');
        if (step.elapsed !== undefined) {
          log(`      ⏱️  ${step.elapsed}ms`, 'yellow');
        }
      });
    }
  }
  
  log('\n' + '='.repeat(60), 'bright');
}

async function main() {
  try {
    log('\n🎯 Replay Attack Simulation Script', 'bright');
    log('='.repeat(60), 'bright');
    
    if (API_BASE !== 'https://localhost:8443') {
      log(`\n🌐 Using API URL: ${API_BASE}`, 'cyan');
    }
    
    // Step 1: Get token
    let token = config.token;
    if (!token) {
      if (!config.email || !config.password) {
        log('\n❌ Error: Either --token or --email and --password are required', 'red');
        log('   Use --help for usage information', 'yellow');
        process.exit(1);
      }
      token = await login(config.email, config.password);
    } else {
      log('✅ Using provided token', 'green');
    }
    
    // Step 2: Enable attack mode
    if (!config.skipEnable) {
      await enableAttackMode(token);
    } else {
      log('⏭️  Skipping attack mode enable (--skip-enable)', 'yellow');
    }
    
    // Step 3: Check status
    const status = await getAttackStatus(token);
    if (status) {
      log(`\n📊 Attack Mode Status:`, 'bright');
      log(`   Enabled: ${status.enabled ? '✅ Yes' : '❌ No'}`, status.enabled ? 'green' : 'red');
      log(`   Captured Messages: ${status.stats?.capturedMessages || 0}`, 'cyan');
      log(`   Total Attacks: ${status.stats?.totalAttacks || 0}`, 'cyan');
    }
    
    // Step 4: Wait for messages if needed
    if ((status?.stats?.capturedMessages || 0) === 0) {
      await waitForMessages(token, config.waitTime, config.sessionId);
    }
    
    // Step 5: Get captured messages
    log('\n📨 Getting captured messages...', 'cyan');
    const capturedData = await getCapturedMessages(token, config.sessionId);
    
    if (!capturedData) {
      log('❌ No captured messages found. Make sure:', 'red');
      log('   1. Attack mode is enabled', 'yellow');
      log('   2. You have sent messages after enabling attack mode', 'yellow');
      log('   3. The session ID is correct (if specified)', 'yellow');
      process.exit(1);
    }
    
    // Extract messages
    let messages = [];
    if (config.sessionId) {
      messages = capturedData.messages || [];
    } else if (capturedData.messagesBySession) {
      // Get first session's messages
      const sessions = Object.keys(capturedData.messagesBySession);
      if (sessions.length === 0) {
        log('❌ No captured messages found', 'red');
        process.exit(1);
      }
      const firstSession = sessions[0];
      config.sessionId = firstSession;
      messages = capturedData.messagesBySession[firstSession];
      log(`📋 Using session: ${firstSession}`, 'cyan');
    } else {
      messages = capturedData.messages || [];
    }
    
    if (messages.length === 0) {
      log('❌ No messages found for the specified session', 'red');
      process.exit(1);
    }
    
    log(`✅ Found ${messages.length} captured message(s)`, 'green');
    
    // Step 6: Select message
    let selectedMessage = messages[0];
    if (messages.length > 1) {
      log(`\n📋 Available messages:`, 'bright');
      messages.forEach((msg, index) => {
        log(`   ${index + 1}. Message ID: ${msg.messageId} (seq: ${msg.seq}, type: ${msg.type})`, 'blue');
      });
      log(`\n   Using first message: ${selectedMessage.messageId}`, 'yellow');
    }
    
    // Step 7: Run attack simulation
    const result = await runAttackSimulation(
      token,
      config.sessionId || selectedMessage.sessionId,
      selectedMessage.messageId,
      config.attackType
    );
    
    // Step 8: Display results
    displayAttackResults(result);
    
    log('\n✅ Attack simulation completed!', 'green');
    log('\n💡 Tip: Check server/logs/replay_attempts.log for detailed logs', 'cyan');
    log('💡 Tip: Check MongoDB security_logs collection for stored logs', 'cyan');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main();
