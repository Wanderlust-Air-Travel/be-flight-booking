import { spawn, ChildProcess } from 'child_process';

interface Service {
  name: string;
  script: string;
  port: number;
}

interface ProcessInfo {
  name: string;
  process: ChildProcess;
}

const services: Service[] = [
  { name: 'Search MS', script: 'dist/microservices/search/main.search.js', port: 4001 },
  { name: 'Services MS', script: 'dist/microservices/services/main.services.js', port: 4002 },
  { name: 'Routes MS', script: 'dist/microservices/routes/main.routes.js', port: 4003 },
  { name: 'Booking MS', script: 'dist/microservices/booking/main.booking.js', port: 4004 },
  { name: 'Reservation MS', script: 'dist/microservices/reservation/main.reservation.js', port: 4005 },
  { name: 'Payment MS', script: 'dist/microservices/payment/main.payment.js', port: 4006 },
];

const processes: ProcessInfo[] = [];

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

