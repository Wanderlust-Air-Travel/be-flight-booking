import { spawn, execSync } from 'child_process';
import { promisify } from 'util';

/**
 * Setup script for local development
 * This script runs all setup steps before starting the application locally
 */

async function runCommand(command: string, description: string): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${description}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Use execSync for better error handling on Windows
    const { execSync } = require('child_process');
    
    try {
      execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env,
      });
      console.log(`✅ ${description} - Completed successfully\n`);
      return true;
    } catch (error: any) {
      if (error.status !== 0) {
        console.error(`❌ ${description} - Failed with exit code ${error.status}\n`);
        throw error;
      }
      return true;
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('\n🚀 Starting Local Development Setup');
  console.log('This will setup the database and prepare the environment...\n');
  
  // First check if Docker services are running
  try {
    const { execSync } = require('child_process');
    execSync('npm run check:docker', { stdio: 'inherit', cwd: process.cwd() });
  } catch (error) {
    console.error('\n❌ Docker services check failed. Please start Docker services first.');
    console.error('   Run: docker compose -f docker-compose.services.yml up -d\n');
    process.exit(1);
  }

  const steps = [
    {
      command: 'npm run wait-for-sqlserver',
      description: 'Waiting for SQL Server to be ready',
    },
    {
      command: 'npm run wait-for-rabbitmq',
      description: 'Waiting for RabbitMQ to be ready',
    },
    {
      command: 'npm run init-db',
      description: 'Initializing database (create DB + run migrations)',
    },
    {
      command: 'npm run wait-for-db',
      description: 'Waiting for database to be accessible',
    },
    {
      command: 'npm run migration:run:missing',
      description: 'Running any missing migrations (ensuring all tables exist)',
      optional: true,
    },
    {
      command: 'npm run seed:if-empty',
      description: 'Seeding database if empty',
    },
    {
      command: 'npm run gmail:auth',
      description: 'Authenticating Gmail (optional - may skip if fails)',
      optional: true,
    },
  ];

  for (const step of steps) {
    try {
      await runCommand(step.command, step.description);
    } catch (error) {
      if (step.optional) {
        console.log(`⚠️  ${step.description} - Skipped (optional step failed)\n`);
        continue;
      }
      console.error(`\n❌ Setup failed at: ${step.description}`);
      console.error('Please check the errors above and try again.\n');
      process.exit(1);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Setup completed successfully!');
  console.log('='.repeat(60));
  console.log('\n📝 Next steps:');
  console.log('   1. Run: npm run start:all (to start all services)');
  console.log('   2. Or run individual services:');
  console.log('      - npm run start:dev (API Gateway only)');
  console.log('      - npm run start:search:dev (Search microservice)');
  console.log('      - etc...\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ Fatal error during setup:', error);
  process.exit(1);
});

