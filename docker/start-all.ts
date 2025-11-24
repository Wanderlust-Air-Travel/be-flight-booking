import { spawn } from 'child_process';
import { Service, ProcessInfo } from './start-all.types';

// Helper function to wait
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const services: Service[] = [
  { name: 'Search MS', script: 'dist/microservices/search/main.search.js', port: 4001 },
  { name: 'Services MS', script: 'dist/microservices/services/main.services.js', port: 4002 },
  { name: 'Routes MS', script: 'dist/microservices/routes/main.routes.js', port: 4003 },
  { name: 'Booking MS', script: 'dist/microservices/booking/main.booking.js', port: 4004 },
  { name: 'Reservation MS', script: 'dist/microservices/reservation/main.reservation.js', port: 4005 },
  { name: 'Payment MS', script: 'dist/microservices/payment/main.payment.js', port: 4006 },
  { name: 'Email MS', script: 'dist/microservices/email/main.email.js', port: 4007 },
];

const processes: ProcessInfo[] = [];

// Main function to start all services
async function startServices() {
  // Wait longer to ensure database is fully ready before starting services
  // This gives time for database to be fully initialized after init-db
  console.log('Waiting for database to be fully ready before starting services...');
  await wait(10000); // Increased to 10 seconds

  // Start all microservices
  console.log('Starting all microservices...');
  services.forEach(service => {
    const proc = spawn('node', [service.script], {
      stdio: 'inherit',
      cwd: process.cwd(),
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
    console.log(`Started ${service.name} on port ${service.port}`);
  });

  // Wait a bit for microservices to start
  setTimeout(() => {
    console.log('Starting API Gateway...');
    const apiGateway = spawn('node', ['dist/api-gateway/main.js'], {
      stdio: 'inherit',
      cwd: process.cwd(),
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

