#!/usr/bin/env node
/**
 * Cross-platform migration runner.
 * - Sets NODE_ENV=development if not provided
 * - Overrides DB_HOST to localhost when running from the host machine
 *   (Docker compose services use the container name "sqlserver")
 * - Invokes typeorm-ts-node-commonjs with the correct config path.
 *
 * Usage:
 *   node scripts/run-migration.js <generate|run|revert|show> [args]
 */

const { spawn } = require('node:child_process');

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

// Running from host machine — use localhost instead of Docker service name
if (process.env.DB_HOST === 'sqlserver' && !process.env.DB_HOST_OVERRIDE) {
    process.env.DB_HOST = 'localhost';
    console.log('[run-migration] DB_HOST=sqlserver detected — overriding to localhost for host execution');
}

const command = process.argv[2];
if (!command) {
    console.error('Usage: node scripts/run-migration.js <generate|run|revert|show> [args]');
    process.exit(1);
}

const configPath = 'src-nestjs/shared/config/typeorm.ts';
const cliArgs = [
    `migration:${command}`,
    '-d', configPath,
    ...process.argv.slice(3),
];

console.log(`[run-migration] NODE_ENV=${process.env.NODE_ENV}`);
console.log(`[run-migration] Running: typeorm-ts-node-commonjs ${cliArgs.join(' ')}`);

const child = spawn(
    'npx',
    ['typeorm-ts-node-commonjs', ...cliArgs],
    { stdio: 'inherit', env: process.env, shell: true },
);

child.on('exit', (code) => {
    process.exit(code ?? 1);
});