#!/usr/bin/env node
/**
 * Tự động chạy docker compose, check logs backend, fix lỗi đã biết và retry đến khi hết lỗi.
 * Usage: node scripts/docker-up-and-fix.js   hoặc  npm run docker:up-fix
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_RETRIES = 3;
const LOG_TAIL = 300;
const WAIT_AFTER_UP_MS = 45000; // 45s cho backend qua các bước init

const ROOT = path.resolve(__dirname, '..');
const DOCKER_DIR = path.join(ROOT, 'docker');
const COMPOSE_FILE = path.join(ROOT, 'docker-compose.yml');

const KNOWN_ERRORS = [
  { pattern: /gmail-auth\.ts|imaginaryUncacheableRequireResolveScript/, fix: 'remove_gmail_from_command' },
  { pattern: /illegal option|: not found|\\r/, fix: 'fix_crlf_shell_scripts' },
  { pattern: /Cannot find module '\.\/services\.module'/, fix: 'use_start_all_prod' },
];

function fixCrlfShellScripts() {
  let fixed = 0;
  if (!fs.existsSync(DOCKER_DIR)) return fixed;
  const files = fs.readdirSync(DOCKER_DIR).filter((f) => f.endsWith('.sh'));
  for (const file of files) {
    const filePath = path.join(DOCKER_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('\r')) {
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      fs.writeFileSync(filePath, content, 'utf8');
      fixed++;
      console.log('[Fix] Removed CRLF from', file);
    }
  }
  return fixed;
}

function ensureComposeNoGmailAuth() {
  const filePath = COMPOSE_FILE;
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  if (content.includes('gmail:auth') && content.includes('start:all:prod')) {
    content = content.replace(
      /&&\s*\([^)]*gmail:auth[^)]*\)\s*&&\s*npm run start:all:prod/,
      '&& npm run start:all:prod'
    );
    content = content.replace(
      /&&\s*\(\[[^\]]+\]\s*&&\s*npm run gmail:auth[^)]*\)\s*&&\s*npm run start:all:prod/,
      '&& npm run start:all:prod'
    );
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[Fix] Removed gmail:auth from docker-compose backend command');
    return true;
  }
  return false;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: ROOT,
      shell: true,
      stdio: opts.stdio || 'inherit',
      ...opts,
    });
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('Exit ' + code))));
  });
}

function runCapture(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd: ROOT, shell: true });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('error', reject);
    proc.on('exit', (code) => resolve({ code, out: out + err }));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function detectErrors(logText) {
  const found = [];
  for (const { pattern, fix } of KNOWN_ERRORS) {
    if (pattern.test(logText)) found.push(fix);
  }
  return [...new Set(found)];
}

function applyFix(fixId) {
  switch (fixId) {
    case 'fix_crlf_shell_scripts':
      return fixCrlfShellScripts() > 0;
    case 'remove_gmail_from_command':
      return ensureComposeNoGmailAuth();
    case 'use_start_all_prod':
      return false;
    default:
      return false;
  }
}

async function main() {
  console.log('=== Docker up & auto-fix (max retries:', MAX_RETRIES, ') ===\n');

  fixCrlfShellScripts();
  ensureComposeNoGmailAuth();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log('\n--- Attempt', attempt, '/', MAX_RETRIES, '---');
    try {
      console.log('Running: docker compose up -d --build ...');
      await run('docker', ['compose', 'up', '-d', '--build']).catch((e) => {
        console.error('docker compose up failed:', e.message);
        throw e;
      });

      console.log('Waiting', WAIT_AFTER_UP_MS / 1000, 's for backend to start...');
      await sleep(WAIT_AFTER_UP_MS);

      const { out: logs } = await runCapture('docker', [
        'compose',
        'logs',
        '--tail',
        String(LOG_TAIL),
        'backend',
      ]);
      const errors = detectErrors(logs);

      if (errors.length === 0) {
        console.log('\nNo known errors in logs. Checking /health...');
        const res = await runCapture('docker', [
          'compose', 'exec', '-T', 'backend',
          'wget', '-q', '-O-', 'http://localhost:3000/api/v1/health',
        ]).catch(() => ({ code: 1, out: '' }));
        if (res.code === 0 && res.out && res.out.includes('status')) {
          console.log('\nBackend health OK. Done.');
          process.exit(0);
        }
        console.log('\nBackend may still be starting. Check: docker compose logs -f backend');
        process.exit(0);
      }

      console.log('\nDetected issues:', errors.join(', '));
      let anyFixed = false;
      for (const fixId of errors) {
        if (applyFix(fixId)) anyFixed = true;
      }
      if (!anyFixed && errors.includes('fix_crlf_shell_scripts')) {
        const shPath = path.join(DOCKER_DIR, 'start-all-prod.sh');
        if (fs.existsSync(shPath)) {
          const content = fs.readFileSync(shPath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          fs.writeFileSync(shPath, content, 'utf8');
          console.log('[Fix] Rewrote start-all-prod.sh with LF only');
          anyFixed = true;
        }
      }
      if (!anyFixed) {
        console.log('\nCould not auto-fix. Last logs (tail):');
        console.log(logs.slice(-4000));
        process.exit(1);
      }
      console.log('Applied fixes. Rebuilding...');
      await run('docker', ['compose', 'down']);
      await sleep(3000);
    } catch (e) {
      console.error('Attempt failed:', e.message);
      if (attempt === MAX_RETRIES) {
        console.error('Max retries reached.');
        process.exit(1);
      }
      await sleep(5000);
    }
  }
  process.exit(1);
}

main();
