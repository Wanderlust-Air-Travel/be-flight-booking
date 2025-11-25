/**
 * Entrypoint script để:
 * 1. Start tất cả services (microservices + API Gateway)
 * 2. Đợi API Gateway sẵn sàng
 * 3. Chạy download:deals-images
 * 4. Giữ tất cả services chạy
 */

import { spawn } from 'child_process';
import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const MAX_WAIT_RETRIES = 60; // 60 lần * 2s = 2 phút
const RETRY_DELAY = 2000; // 2 giây

// Helper function to wait
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if API Gateway is ready
async function waitForApiGateway(): Promise<boolean> {
  // Health endpoint is at /api/v1/health (due to global prefix 'api' and versioning)
  const healthUrl = `${API_BASE_URL}/api/v1/health`;
  
  for (let attempt = 1; attempt <= MAX_WAIT_RETRIES; attempt++) {
    try {
      const response = await axios.get(healthUrl, {
        timeout: 5000,
      });
      
      if (response.status === 200) {
        console.log(`API Gateway đã sẵn sàng (attempt ${attempt})`);
        return true;
      }
    } catch (error: any) {
      // Ignore errors, continue retrying
    }
    
    if (attempt < MAX_WAIT_RETRIES) {
      if (attempt % 10 === 0) {
        console.log(`Đang đợi API Gateway... (${attempt}/${MAX_WAIT_RETRIES})`);
      }
      await wait(RETRY_DELAY);
    }
  }
  
  return false;
}

// Run download:deals-images script
async function runDownloadDealsImages(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('\nBắt đầu download ảnh cho deals...\n');
    
    const proc = spawn('npm', ['run', 'download:deals-images'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: true,
    });
    
    proc.on('error', (error: Error) => {
      console.error('Lỗi khi chạy download:deals-images:', error);
      reject(error);
    });
    
    proc.on('exit', (code: number | null) => {
      if (code === 0) {
        console.log('\nDownload ảnh hoàn tất!\n');
        resolve();
      } else {
        console.error(`\ndownload:deals-images exited with code ${code}`);
        // Không reject, chỉ warn vì đây không phải critical
        resolve();
      }
    });
  });
}

// Main function
async function main() {
  console.log('Starting backend services...\n');
  
  // Start all services in background (detached)
  // start:all sẽ spawn các microservices và API Gateway, giữ chúng chạy
  const startAllProc = spawn('npm', ['run', 'start:all'], {
    stdio: 'inherit', // Inherit để xem logs từ start:all
    cwd: process.cwd(),
    shell: true,
    detached: false, // Không detached để có thể kill khi cần
  });
  
  startAllProc.on('error', (error: Error) => {
    console.error('Lỗi khi start services:', error);
    process.exit(1);
  });
  
  startAllProc.on('exit', (code: number | null) => {
    console.log(`\nstart:all process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      process.exit(code);
    }
  });
  
  // Wait a bit for services to start
  await wait(5000); // Đợi 5 giây để services bắt đầu khởi động
  
  // Wait for API Gateway to be ready
  console.log('\nĐang đợi API Gateway khởi động...');
  const apiReady = await waitForApiGateway();
  
  if (!apiReady) {
    console.error('API Gateway không sẵn sàng sau nhiều lần thử');
    console.error('   Tiếp tục chạy services, nhưng download:deals-images sẽ bị skip');
  } else {
    // Run download:deals-images
    try {
      await runDownloadDealsImages();
    } catch (error: any) {
      console.error('Lỗi khi download ảnh (không critical, services vẫn chạy):', error.message);
    }
  }
  
  console.log('\nTất cả services đang chạy. API Gateway tại:', API_BASE_URL);
  console.log('   Để dừng, nhấn Ctrl+C\n');
  
  // Keep the process alive by waiting for start:all process
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down all services...');
    if (startAllProc && !startAllProc.killed) {
      startAllProc.kill('SIGINT');
    }
    // Give processes time to shutdown gracefully
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });
  
  process.on('SIGTERM', () => {
    console.log('\nShutting down all services...');
    if (startAllProc && !startAllProc.killed) {
      startAllProc.kill('SIGTERM');
    }
    // Give processes time to shutdown gracefully
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });
  
  // Wait for start:all process to keep container alive
  // This will block until start:all exits (which should not happen in normal operation)
  await new Promise<void>((resolve) => {
    startAllProc.on('exit', () => {
      resolve();
    });
  });
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

