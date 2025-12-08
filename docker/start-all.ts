import { spawn } from 'child_process';
import { Service, ProcessInfo } from './start-all.types';

// Helper function to wait
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const services: Service[] = [
  { name: 'Search MS', script: 'start:search:dev', port: 4001, useNodemon: true },
  { name: 'Services MS', script: 'start:services:dev', port: 4002, useNodemon: true },
  { name: 'Routes MS', script: 'start:routes:dev', port: 4003, useNodemon: true },
  { name: 'Booking MS', script: 'start:booking:dev', port: 4004, useNodemon: true },
  { name: 'Reservation MS', script: 'start:reservation:dev', port: 4005, useNodemon: true },
  { name: 'Payment MS', script: 'start:payment:dev', port: 4006, useNodemon: true },
  { name: 'Email MS', script: 'start:email:dev', port: 4007, useNodemon: true },
];

const processes: ProcessInfo[] = [];

// Main function to start all services
async function startServices() {
  // Wait longer to ensure database is fully ready before starting services
  // This gives time for database to be fully initialized after init-db
  console.log('Waiting for database to be fully ready before starting services...');
  await wait(10000); // Increased to 10 seconds

  // Start all microservices
  console.log('Starting all microservices with watch mode (nodemon)...');
  services.forEach(service => {
    // Use npm scripts which already have nodemon configured properly
    // This ensures nodemon.json config is used and prevents infinite restart loops
    const command = service.useNodemon ? 'npm' : 'node';
    const args = service.useNodemon 
      ? ['run', service.script]
      : [service.script];
    
    const proc = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: true, // Required for npm on Windows
    });
    
    proc.on('error', (error: Error) => {
      console.error(`Error starting ${service.name}:`, error);
    });
    
    proc.on('exit', (code: number | null) => {
      if (code !== 0 && code !== null) {
        console.error(`${service.name} exited with code ${code}`);
      }
    });
    
    processes.push({ name: service.name, process: proc });
    console.log(`Started ${service.name} on port ${service.port} (with watch mode)`);
  });

  // Wait a bit for microservices to start
  setTimeout(() => {
    console.log('Starting API Gateway with watch mode...');
    // Use nest start --watch for hot reload
    const apiGateway = spawn('npm', ['run', 'start:dev'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: true, // Required for npm on Windows
    });
    
    apiGateway.on('error', (error: Error) => {
      console.error('Error starting API Gateway:', error);
    });
    
    apiGateway.on('exit', (code: number | null) => {
      console.log(`API Gateway exited with code ${code}`);
      // Kill all microservices when API Gateway exits
      processes.forEach(({ name, process: proc }) => {
        console.log(`Stopping ${name}...`);
        proc.kill();
      });
      process.exit(code || 0);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down all services...');
      apiGateway.kill();
      processes.forEach(({ process: proc }) => proc.kill());
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\nShutting down all services...');
      apiGateway.kill();
      processes.forEach(({ process: proc }) => proc.kill());
      process.exit(0);
    });
  }, 3000);
}

// Start services
startServices().catch(error => {
  console.error('Fatal error starting services:', error);
  process.exit(1);
});

