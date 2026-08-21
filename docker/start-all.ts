import { spawn, ChildProcess, exec } from 'child_process';
import { Service, ProcessInfo } from './start-all.types';
import * as net from 'net';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper function to wait
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Kill process on port (Windows)
async function killProcessOnPort(port: number): Promise<boolean> {
  try {
    // Find process using the port
    const { stdout } = await execAsync(
      `powershell -ExecutionPolicy Bypass -Command "netstat -ano | Select-String ':${port}' | Select-String 'LISTENING'"`
    );
    const lines = stdout.toString().trim().split('\n');

    if (lines.length === 0 || lines[0].trim() === '') {
      return false; // No process found
    }

    // Extract PID from the last column
    const pids = new Set<string>();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 0) {
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(parseInt(pid))) {
          pids.add(pid);
        }
      }
    }

    // Kill all processes
    for (const pid of pids) {
      try {
        await execAsync(
          `powershell -ExecutionPolicy Bypass -Command "taskkill /F /PID ${pid} 2>&1 | Out-String"`
        );
        console.log(`  Killed process ${pid} on port ${port}`);
      } catch (error: any) {
        // Access denied or not found — skip silently
        if (error.message.includes('Access is denied')) {
          console.warn(`  [SKIP] Need admin to kill process ${pid} on port ${port}`);
        } else if (!error.message.includes('not found') && !error.message.includes('not be found')) {
          console.warn(`  Could not kill process ${pid}: ${error.message.trim()}`);
        }
      }
    }

    // Wait a bit for port to be released
    await wait(1000);
    return true;
  } catch (error: any) {
    // No process found or other error
    if (error.code === 1 || error.message.includes('not found') || error.message.includes('not be found')) {
      return false;
    }
    // Access denied from netstat itself
    if (error.message.includes('Access is denied')) {
      console.warn(`  [SKIP] Need admin to check port ${port} — skipping kill step`);
      return false;
    }
    console.warn(`  Error checking port ${port}: ${error.message.trim()}`);
    return false;
  }
}

// Check if port is listening
function isPortListening(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, which means service might be running
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    
    server.listen(port, host);
  });
}

// Check if port is actually listening (more reliable check)
async function checkPortHealth(port: number, host: string = '127.0.0.1', timeout: number = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
      }
    };
    
    socket.setTimeout(timeout);
    
    socket.once('connect', () => {
      cleanup();
      resolve(true);
    });
    
    socket.once('timeout', () => {
      cleanup();
      resolve(false);
    });
    
    socket.once('error', () => {
      cleanup();
      resolve(false);
    });
    
    socket.connect(port, host);
  });
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

const processes: Map<string, ProcessInfo & { retryCount: number; lastStartTime: number }> = new Map();
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const HEALTH_CHECK_DELAY = 3000; // Wait 3 seconds before first health check
const HEALTH_CHECK_INTERVAL = 10000; // Check every 10 seconds
const START_TIMEOUT = 30000; // 30 seconds timeout for service to start

// Main function to start all services
async function startServices() {
  // Wait longer to ensure database is fully ready before starting services
  // This gives time for database to be fully initialized after init-db
  console.log('⏳ Waiting for database to be fully ready before starting services...');
  await wait(10000); // Increased to 10 seconds

  // Check for port conflicts and kill old processes
  console.log('🔍 Checking for port conflicts...');
  for (const service of services) {
    const portInUse = await isPortListening(service.port);
    if (portInUse) {
      console.warn(`⚠️  Port ${service.port} is already in use. Killing old process...`);
      await killProcessOnPort(service.port);
      // Wait a bit more to ensure port is released
      await wait(1000);
    }
  }

  // Start all microservices
  console.log('🚀 Starting all microservices with watch mode (nodemon)...');
  for (const service of services) {
    await startService(service);
    // Small delay between starts to avoid overwhelming the system
    await wait(1000);
  }

  // Start health check monitoring
  startHealthCheckMonitoring();

  // Wait a bit for microservices to start
  setTimeout(() => {
    console.log('🌐 Starting API Gateway with watch mode...');
    // Use nest start --watch for hot reload
    const apiGateway = spawn('npm', ['run', 'start:dev'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: true, // Required for npm on Windows
    });
    
    apiGateway.on('error', (error: Error) => {
      console.error('❌ Error starting API Gateway:', error);
    });
    
    apiGateway.on('exit', (code: number | null) => {
      console.log(`🛑 API Gateway exited with code ${code}`);
      // Kill all microservices when API Gateway exits
      processes.forEach(({ name, process: proc }) => {
        console.log(`🛑 Stopping ${name}...`);
        proc.kill();
      });
      process.exit(code || 0);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down all services...');
      apiGateway.kill();
      processes.forEach(({ process: proc }) => proc.kill());
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down all services...');
      apiGateway.kill();
      processes.forEach(({ process: proc }) => proc.kill());
      process.exit(0);
    });
  }, 3000);
}

// Start a single service with retry mechanism
async function startService(service: Service, retryCount: number = 0): Promise<void> {
  const serviceKey = service.name;
  const existingProcess = processes.get(serviceKey);
  
  // If service is already running and healthy, skip
  if (existingProcess && !existingProcess.process.killed) {
    const isHealthy = await checkPortHealth(service.port);
    if (isHealthy) {
      console.log(`✅ ${service.name} is already running and healthy on port ${service.port}`);
      return;
    }
  }

  // Check if we've exceeded max retries
  if (retryCount >= MAX_RETRIES) {
    console.error(`❌ ${service.name} failed to start after ${MAX_RETRIES} attempts. Giving up.`);
    return;
  }

  if (retryCount > 0) {
    console.log(`🔄 Retrying to start ${service.name} (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
    await wait(RETRY_DELAY);
  }

  try {
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
      console.error(`❌ Error starting ${service.name}:`, error.message);
      // Retry on error
      setTimeout(() => {
        startService(service, retryCount + 1);
      }, RETRY_DELAY);
    });
    
    proc.on('exit', (code: number | null) => {
      const processInfo = processes.get(serviceKey);
      if (processInfo && !processInfo.process.killed) {
        if (code !== 0 && code !== null) {
          console.error(`❌ ${service.name} exited with code ${code}`);
          // Only retry if it's not a manual kill and we haven't exceeded retries
          if (retryCount < MAX_RETRIES) {
            console.log(`🔄 Will retry starting ${service.name} in ${RETRY_DELAY / 1000} seconds...`);
            setTimeout(() => {
              startService(service, retryCount + 1);
            }, RETRY_DELAY);
          }
        } else {
          console.log(`ℹ️  ${service.name} exited normally`);
        }
      }
    });
    
    processes.set(serviceKey, {
      name: service.name,
      process: proc,
      retryCount,
      lastStartTime: Date.now(),
    });
    
    console.log(`✅ Started ${service.name} on port ${service.port} (with watch mode)`);
    
    // Wait a bit and check if service is actually listening
    await wait(HEALTH_CHECK_DELAY);
    const isHealthy = await checkPortHealth(service.port);
    if (!isHealthy) {
      console.warn(`⚠️  ${service.name} started but port ${service.port} is not responding yet. Will check again in health check.`);
    } else {
      console.log(`✅ ${service.name} is healthy and listening on port ${service.port}`);
    }
  } catch (error: any) {
    console.error(`❌ Failed to start ${service.name}:`, error.message);
    if (retryCount < MAX_RETRIES) {
      setTimeout(() => {
        startService(service, retryCount + 1);
      }, RETRY_DELAY);
    }
  }
}

// Health check monitoring
function startHealthCheckMonitoring() {
  console.log('🏥 Starting health check monitoring...');
  
  setInterval(async () => {
    for (const service of services) {
      const processInfo = processes.get(service.name);
      
      if (!processInfo) {
        console.warn(`⚠️  ${service.name} process info not found. Attempting to restart...`);
        await startService(service);
        continue;
      }
      
      // Skip if process was manually killed
      if (processInfo.process.killed) {
        continue;
      }
      
      // Check if process is still running
      try {
        processInfo.process.kill(0); // Signal 0 doesn't kill, just checks if process exists
      } catch (error) {
        console.warn(`⚠️  ${service.name} process is not running. Attempting to restart...`);
        await startService(service);
        continue;
      }
      
      // Check if port is listening
      const isHealthy = await checkPortHealth(service.port);
      if (!isHealthy) {
        const timeSinceStart = Date.now() - processInfo.lastStartTime;
        
        // If service just started, give it more time
        if (timeSinceStart < START_TIMEOUT) {
          console.log(`⏳ ${service.name} is still starting up (${Math.round(timeSinceStart / 1000)}s elapsed)...`);
          continue;
        }
        
        // If service has been running for a while but port is not responding, restart
        console.warn(`⚠️  ${service.name} process is running but port ${service.port} is not responding. Restarting...`);
        try {
          processInfo.process.kill('SIGTERM');
          await wait(2000);
        } catch (error) {
          // Ignore kill errors
        }
        await startService(service, 0);
      }
    }
  }, HEALTH_CHECK_INTERVAL);
}

// Start services
startServices().catch(error => {
  console.error('❌ Fatal error starting services:', error);
  process.exit(1);
});
