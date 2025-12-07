import { DataSource } from 'typeorm';
import * as path from 'path';
import { config } from 'dotenv';
import { resolve } from 'path';
import { CreateBaggageAndCabinServiceTables1700000004000 } from '../src/migrations/1700000004000-CreateBaggageAndCabinServiceTables';

// Load .env file
config({ path: resolve(process.cwd(), '.env') });

/**
 * Script to ensure all migrations are run, especially if some were missed
 */
async function runMissingMigrations(): Promise<void> {
  console.log('Checking and running missing migrations...\n');
  
  let dbHost = process.env.DB_HOST;
  if (!dbHost) {
    dbHost = 'localhost'; // Default to localhost for local development
  }
  const isDockerNetwork = dbHost === 'sqlserver' || dbHost.includes('.docker');
  const defaultPort = isDockerNetwork ? 1433 : 1434;
  const dbPort = parseInt(process.env.DB_PORT || defaultPort.toString(), 10);
  
  const dataSource = new DataSource({
    type: 'mssql',
    host: dbHost,
    port: dbPort,
    username: process.env.DB_USER || 'sa',
    password: process.env.DB_PASS || 'Passw0rd123!',
    database: process.env.DB_NAME || 'flight_booking_db',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    },
    extra: {
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    },
    entities: [path.join(__dirname, '../src/shared/entities/**/*.entity.ts')],
    migrations: [path.join(__dirname, '../src/migrations/*.ts')],
    migrationsTableName: 'migrations',
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ DataSource initialized\n');
    
    // Check if BaggageAllowances table exists first
    const tableCheck = await dataSource.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'BaggageAllowances'
    `);
    const tableExists = tableCheck[0] && tableCheck[0].count > 0;
    
    if (!tableExists) {
      console.log('⚠️  BaggageAllowances table does not exist!');
      console.log('   Checking migration status...\n');
      
      // Check if migration was marked as executed
      const migrationCheck = await dataSource.query(`
        SELECT * FROM migrations 
        WHERE name LIKE '%CreateBaggageAndCabinServiceTables%'
      `);
      
      if (migrationCheck.length === 0) {
        console.log('✅ Migration not found in migrations table, will run it...\n');
      } else {
        console.log('⚠️  Migration was marked as executed but table does not exist!');
        console.log('   This suggests the migration failed silently.\n');
      }
    }
    
    // Run pending migrations
    console.log('Running pending migrations...\n');
    const migrations = await dataSource.runMigrations();
    
    if (migrations && migrations.length > 0) {
      console.log(`✅ Executed ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        console.log(`   - ${migration.name}`);
      });
    } else {
      console.log('✅ No new migrations to run');
      
      // Double check table exists after running migrations
      const finalCheck = await dataSource.query(`
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'BaggageAllowances'
      `);
      
      if (finalCheck[0] && finalCheck[0].count > 0) {
        console.log('✅ All migrations are up to date and tables exist');
      } else {
        console.log('\n❌ ERROR: BaggageAllowances table still does not exist!');
        console.log('   Attempting to run migration manually...\n');
        
        try {
          const queryRunner = dataSource.createQueryRunner();
          await queryRunner.connect();
          
          const migration = new CreateBaggageAndCabinServiceTables1700000004000();
          await migration.up(queryRunner);
          
          await queryRunner.release();
          console.log('✅ Successfully created BaggageAllowances and CabinServices tables manually!');
        } catch (manualError: any) {
          console.error('❌ Failed to run migration manually:', manualError.message);
          console.error('   Please check the database and run the migration manually if needed.');
          await dataSource.destroy();
          process.exit(1);
        }
      }
    }
    
    await dataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error running migrations:', error.message);
    console.error(error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

runMissingMigrations();

