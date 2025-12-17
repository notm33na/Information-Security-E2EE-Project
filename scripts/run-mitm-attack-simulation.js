#!/usr/bin/env node

/**
 * Automated MITM Attack Simulation Script
 * 
 * This script automates the entire MITM attack simulation process:
 * 1. Login (or use existing token)
 * 2. Enable MITM attack mode
 * 3. Wait for key exchange to occur
 * 4. Run MITM attack simulations
 * 5. Display results
 * 
 * Usage:
 *   node scripts/run-mitm-attack-simulation.js [options]
 * 
 * Options:
 *   --email <email>        Login email (required if no token)
 *   --password <password>  Login password (required if no token)
 *   --token <token>        Use existing token (skip login)
 *   --session <sessionId>  Specific session to attack (optional, auto-detects if not provided)
 *   --attack-type <type>   Attack type: unsigned, signed, key-confirmation (default: unsigned)
 *   --wait <seconds>       Wait time for key exchange to occur (default: 15)
 *   --skip-enable          Skip enabling attack mode (assume already enabled)
 */

import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const API_BASE = process.env.API_URL || 'https://localhost:8443';
const INSECURE = process.env.INSECURE !== 'false' && (process.env.INSECURE === 'true' || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || true);

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  email: null,
  password: null,
  token: null,
  sessionId: null,
  attackType: 'unsigned',
  waitTime: 15,
  skipEnable: false
};

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

// Parse arguments
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
Automated MITM Attack Simulation Script

Usage:
  node scripts/run-mitm-attack-simulation.js [options]
  node scripts/run-mitm-attack-simulation.js <email> <password>  [positional args]

Options:
  --email <email>          Login email (required if no token)
  --password <password>    Login password (required if no token)
  --token <token>          Use existing token (skip login)
  --session <sessionId>    Specific session to attack (optional, auto-detects if not provided)
  --attack-type <type>     Attack type: unsigned, signed, key-confirmation (default: unsigned)
  --wait <seconds>         Wait time for key exchange to occur (default: 15)
  --skip-enable            Skip enabling attack mode (assume already enabled)
  --help, -h               Show this help message

Examples:
  # Login and run unsigned MITM attack
  node scripts/run-mitm-attack-simulation.js --email test@example.com --password Test123!@#

  # Login with positional arguments
  node scripts/run-mitm-attack-simulation.js test@example.com Test123!@#

  # Use existing token
  node scripts/run-mitm-attack-simulation.js --token YOUR_TOKEN

  # Run signed MITM attack on specific session
  node scripts/run-mitm-attack-simulation.js --token YOUR_TOKEN --session session-123 --attack-type signed
`);
    process.exit(0);
  } else if (!arg.startsWith('--')) {
    positionalArgs.push(arg);
  }
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed.error || parsed.message || data}`));
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
  const response = await makeRequest('POST', '/api/auth/login', {
    body: { email, password }
  });
  return response.data.accessToken;
}

async function enableMITMMode(token) {
  await makeRequest('POST', '/api/mitm-attack/toggle', {
    headers: { Authorization: `Bearer ${token}` },
    body: { enabled: true }
  });
}

async function getMITMStatus(token) {
  return await makeRequest('GET', '/api/mitm-attack/status', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function getInterceptedKEP(token, sessionId = null) {
  const path = sessionId ? `/api/mitm-attack/intercepted/${sessionId}` : '/api/mitm-attack/intercepted/all';
  return await makeRequest('GET', path, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function waitForKeyExchange(token, waitTime, sessionId) {
  log(`\n⏳ Waiting ${waitTime} seconds for key exchange to occur...`, 'cyan');
  log('', 'reset');
  log('   📋 TO TRIGGER KEY EXCHANGE:', 'bright');
  log('   1. Open the application in your browser', 'yellow');
  log('   2. Start a NEW chat session with a different user', 'yellow');
  log('      OR delete the existing session and start a new one', 'yellow');
  log('   3. The key exchange (KEP_INIT/KEP_RESPONSE) will happen automatically', 'yellow');
  log('   4. Watch server logs for [MITM_ATTACK] interception messages', 'yellow');
  log('', 'reset');
  
  for (let i = waitTime; i > 0; i--) {
    process.stdout.write(`\r   ${i} seconds remaining... `);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.stdout.write('\r   Done!                    \n');
}

async function runMITMAttack(token, sessionId, attackType) {
  const endpointMap = {
    'unsigned': '/api/mitm-attack/simulate/unsigned',
    'signed': '/api/mitm-attack/simulate/signed',
    'key-confirmation': '/api/mitm-attack/simulate/key-confirmation'
  };

  const endpoint = endpointMap[attackType];
  if (!endpoint) {
    throw new Error(`Invalid attack type: ${attackType}. Use: unsigned, signed, or key-confirmation`);
  }

  return await makeRequest('POST', endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    body: { sessionId }
  });
}

function displayResults(result) {
  log('\n' + '='.repeat(60), 'bright');
  log('MITM ATTACK SIMULATION RESULTS', 'bright');
  log('='.repeat(60), 'bright');
  log('');
  log(`📋 Attack ID: ${result.data.attackId}`, 'cyan');
  log(`📋 Attack Type: ${result.data.attackType}`, 'cyan');
  log(`📋 Session ID: ${result.data.sessionId}`, 'cyan');
  log('');
  log('🎯 Result:', 'bright');
  if (result.data.success) {
    log(`   ✅ SUCCESS`, 'green');
    log(`   Reason: ${result.data.reason}`, 'yellow');
  } else {
    log(`   ❌ BLOCKED`, 'red');
    log(`   Reason: ${result.data.reason}`, 'yellow');
    if (result.data.protection) {
      log(`   Protection: ${result.data.protection}`, 'cyan');
    }
  }
  log('');
  if (result.data.flow) {
    log('📊 Attack Flow:', 'bright');
    log(`   Duration: ${result.data.flow.duration}ms`, 'cyan');
    log(`   Steps: ${result.data.flow.steps.length}`, 'cyan');
    log('');
    log('📝 Step-by-Step:', 'bright');
    result.data.flow.steps.forEach((step, index) => {
      log(`   ${index + 1}. ${step.description}`, 'reset');
      if (Object.keys(step).length > 4) {
        const data = { ...step };
        delete data.step;
        delete data.description;
        delete data.timestamp;
        delete data.elapsed;
        if (Object.keys(data).length > 0) {
          log(`      ${JSON.stringify(data, null, 2).split('\n').join('\n      ')}`, 'reset');
        }
      }
      log(`      ⏱️  ${step.elapsed}ms`, 'reset');
    });
  }
  log('');
  log('='.repeat(60), 'bright');
  log('');
}

async function main() {
  try {
    log('\n🎯 MITM Attack Simulation Script', 'bright');
    log('='.repeat(60), 'bright');
    log('');

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
      log('🔐 Logging in...', 'cyan');
      token = await login(config.email, config.password);
      log('✅ Login successful!', 'green');
    } else {
      log('✅ Using provided token', 'green');
    }
    
    // Step 2: Enable MITM attack mode
    if (!config.skipEnable) {
      log('⚙️  Enabling MITM attack mode...', 'cyan');
      await enableMITMMode(token);
      log('✅ MITM attack mode enabled!', 'green');
    } else {
      log('⏭️  Skipping MITM mode enable (--skip-enable)', 'yellow');
    }
    
    // Step 3: Check status
    const status = await getMITMStatus(token);
    if (status) {
      log(`\n📊 MITM Attack Mode Status:`, 'bright');
      log(`   Enabled: ${status.data.enabled ? '✅ Yes' : '❌ No'}`, status.data.enabled ? 'green' : 'red');
      log(`   Intercepted Sessions: ${status.data.interceptedSessions || 0}`, 'cyan');
      log(`   Total Attacks: ${status.data.totalAttacks || 0}`, 'cyan');
    }
    
    // Step 4: Wait for key exchange if needed
    if ((status?.data?.interceptedSessions || 0) === 0) {
      await waitForKeyExchange(token, config.waitTime, config.sessionId);
    }
    
    // Step 5: Get intercepted KEP messages
    log('\n📨 Getting intercepted KEP messages...', 'cyan');
    const interceptedData = await getInterceptedKEP(token, config.sessionId || 'all');
    
    if (!interceptedData || !interceptedData.data) {
      log('❌ No intercepted KEP messages found. Make sure:', 'red');
      log('   1. MITM attack mode is enabled', 'yellow');
      log('   2. A key exchange has occurred after enabling attack mode', 'yellow');
      log('   3. The session ID is correct (if specified)', 'yellow');
      process.exit(1);
    }

    // Determine session ID and intercepted data
    let sessionId = config.sessionId;
    let intercepted;
    
    if (config.sessionId) {
      // Specific session requested
      if (!interceptedData.data.intercepted) {
        log('❌ No intercepted KEP messages found for this session', 'red');
        process.exit(1);
      }
      intercepted = interceptedData.data.intercepted;
      sessionId = interceptedData.data.sessionId || config.sessionId;
    } else {
      // Get all sessions - find first one with intercepted data
      const allIntercepted = interceptedData.data.intercepted || {};
      const sessionIds = Object.keys(allIntercepted);
      
      if (sessionIds.length === 0) {
        log('❌ No intercepted KEP messages found. Make sure:', 'red');
        log('   1. MITM attack mode is enabled', 'yellow');
        log('   2. A key exchange has occurred after enabling attack mode', 'yellow');
        log('   3. Check server logs for interception messages', 'yellow');
        process.exit(1);
      }
      
      sessionId = sessionIds[0];
      intercepted = allIntercepted[sessionId];
      log(`📋 Using session: ${sessionId}`, 'cyan');
      if (sessionIds.length > 1) {
        log(`   (Found ${sessionIds.length} sessions, using first one)`, 'yellow');
      }
    }

    if (!intercepted) {
      log('❌ No intercepted data found for this session', 'red');
      process.exit(1);
    }
    
    if (!intercepted.kepInit && !intercepted.kepResponse) {
      log('❌ No KEP_INIT or KEP_RESPONSE intercepted for this session', 'red');
      log('   Make sure both KEP_INIT and KEP_RESPONSE have been sent', 'yellow');
      process.exit(1);
    }

    log(`✅ Found intercepted KEP messages for session ${sessionId}`, 'green');
    if (intercepted.kepInit) {
      log(`   - KEP_INIT: intercepted`, 'cyan');
    }
    if (intercepted.kepResponse) {
      log(`   - KEP_RESPONSE: intercepted`, 'cyan');
    }
    
    // Step 6: Run MITM attack simulation
    log(`\n🚀 Running ${config.attackType} MITM attack simulation...`, 'cyan');
    log(`   Session: ${sessionId}`, 'cyan');
    
    const result = await runMITMAttack(token, sessionId, config.attackType);
    
    // Step 7: Display results
    displayResults(result);
    
    log('✅ MITM attack simulation completed!', 'green');
    log('');
    log('💡 Tip: Check server/logs/invalid_signature.log for detailed logs', 'cyan');
    log('💡 Tip: Check MongoDB security_logs collection for stored logs', 'cyan');
    log('');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
