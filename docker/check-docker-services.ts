import { execSync } from 'child_process';

/**
 * Check if Docker services are running before starting setup
 */
function checkDockerServices(): boolean {
  console.log('🔍 Checking Docker services...\n');
  
  try {
    // Check if docker command is available
    try {
      execSync('docker --version', { stdio: 'pipe' });
    } catch {
      console.error('❌ Docker is not installed or not in PATH');
      console.error('   Please install Docker Desktop and ensure it is running\n');
      return false;
    }
    
    // Check if docker-compose command is available
    try {
      execSync('docker compose version', { stdio: 'pipe' });
    } catch {
      console.error('❌ Docker Compose is not available');
      console.error('   Please ensure Docker Desktop includes Docker Compose\n');
      return false;
    }
    
    // Check if containers are running
    try {
      const output = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf-8' });
      const containers = output.trim().split('\n').filter(Boolean);
      
      const requiredContainers = ['sqlserver', 'redis', 'rabbitmq'];
      const runningContainers = containers.filter(c => requiredContainers.includes(c));
      
      console.log(`📦 Found ${containers.length} running container(s)`);
      
      if (runningContainers.length === 0) {
        console.error('\n❌ Required Docker containers are not running!');
        console.error('   Expected containers: sqlserver, redis, rabbitmq');
        console.error('\n💡 Please start Docker services first:');
        console.error('   docker compose -f docker-compose.services.yml up -d\n');
        return false;
      }
      
      console.log('✅ Required containers are running:');
      runningContainers.forEach(container => {
        console.log(`   - ${container}`);
      });
      
      // Check for missing containers
      const missingContainers = requiredContainers.filter(c => !runningContainers.includes(c));
      if (missingContainers.length > 0) {
        console.warn('\n⚠️  Missing containers:');
        missingContainers.forEach(container => {
          console.warn(`   - ${container}`);
        });
        console.warn('\n💡 Please start all required services:');
        console.warn('   docker compose -f docker-compose.services.yml up -d\n');
        return false;
      }
      
      console.log('\n✅ All required Docker services are running!\n');
      return true;
    } catch (error: any) {
      console.error('❌ Error checking Docker containers:', error.message);
      console.error('\n💡 Please ensure Docker Desktop is running\n');
      return false;
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

if (!checkDockerServices()) {
  process.exit(1);
}

process.exit(0);

