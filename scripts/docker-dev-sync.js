#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * docker-dev-sync.js
 *
 * Picks up local source changes inside the running Docker stack without
 * rebuilding images. Requires the stack to be started with the bind-mount
 *   ./dist:/app/dist
 * that this project ships in docker-compose.yml.
 *
 * Subcommands:
 *   restart-all            restart every app service (microservices first,
 *                          then api-gateway last so it picks up the freshest
 *                          code and reconnects to the freshly-restarted deps)
 *   restart <service>      restart exactly one service (e.g. api-gateway)
 *
 * The 8 app services are mapped 1:1 to their wat-* container names.
 */

const { spawnSync } = require('node:child_process');

const SERVICES = [
  'search-ms',
  'services-ms',
  'routes-ms',
  'reservation-ms',
  'booking-ms',
  'payment-ms',
  'email-ms',
  'api-gateway', // restarted last so it reconnects to the others
];

const containerName = (service) => `wat-${service}`;

function dockerRestart(service) {
  const name = containerName(service);
  console.log(`[docker-dev-sync] restarting ${name} ...`);
  const result = spawnSync('docker', ['restart', name], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`[docker-dev-sync] FAILED to restart ${name}`);
    process.exit(result.status ?? 1);
  }
}

function dockerRunning(service) {
  // Cheap check: does the container exist? `docker inspect` exits 0 if yes.
  const result = spawnSync(
    'docker',
    ['inspect', '--type=container', containerName(service)],
    { stdio: 'ignore' },
  );
  return result.status === 0;
}

function restartAll() {
  // Restart microservices first, then the gateway, so the gateway's restart
  // reconnects to the freshly-reloaded TCP peers. This avoids a window where
  // a microservice holds a stale module cache while the gateway has already
  // moved on.
  for (const service of SERVICES) {
    if (!dockerRunning(service)) {
      console.warn(
        `[docker-dev-sync] skip ${containerName(service)}: container is not running. ` +
          `Start the stack with: docker compose -f docker-compose.yml -f docker-compose.infrastructure.yml --env-file .env.development up -d`,
      );
      continue;
    }
    dockerRestart(service);
  }
  console.log('[docker-dev-sync] done.');
}

function restartOne(service) {
  if (!SERVICES.includes(service)) {
    console.error(
      `[docker-dev-sync] unknown service: ${service}. ` +
        `Valid options: ${SERVICES.join(', ')}`,
    );
    process.exit(1);
  }
  if (!dockerRunning(service)) {
    console.error(
      `[docker-dev-sync] container ${containerName(service)} is not running. ` +
        `Start the stack with: docker compose -f docker-compose.yml -f docker-compose.infrastructure.yml --env-file .env.development up -d`,
    );
    process.exit(1);
  }
  dockerRestart(service);
  console.log('[docker-dev-sync] done.');
}

function main() {
  const [, , subcommand, arg] = process.argv;
  switch (subcommand) {
    case 'restart-all':
      restartAll();
      break;
    case 'restart':
      if (!arg) {
        console.error(
          '[docker-dev-sync] usage: docker-dev-sync restart <service>',
        );
        process.exit(1);
      }
      restartOne(arg);
      break;
    default:
      console.error(
        '[docker-dev-sync] usage:\n' +
          '  docker-dev-sync restart-all\n' +
          '  docker-dev-sync restart <service>   # one of: ' +
          SERVICES.join(', '),
      );
      process.exit(1);
  }
}

main();
