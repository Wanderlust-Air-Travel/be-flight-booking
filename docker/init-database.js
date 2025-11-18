const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');

async function createDatabaseAndUser() {
  console.log('Creating database and user...');
  try {
    const sql = require('mssql');
    // Use SA password from environment (set in docker-compose.yml) or default
    const saPassword = process.env.SA_PASSWORD || 'Passw0rd123!';
    const config = {
      server: process.env.DB_HOST || 'sqlserver',
      port: parseInt(process.env.DB_PORT || '1433'),
      user: 'sa',
      password: saPassword,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
    };

    const pool = await sql.connect(config);
    
    // Create database
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'flight_booking_db')
      BEGIN
        CREATE DATABASE flight_booking_db;
      END
    `);
    console.log('Database created or already exists');

    // Create login and user
    const dbPassword = process.env.DB_PASS || 'Passw0rd123!';
    // Escape single quotes in password for SQL
    const escapedPassword = dbPassword.replace(/'/g, "''");
    
    // Check if login exists and update password, or create new
    const loginCheck = await pool.request().query(`
      SELECT COUNT(*) as count FROM sys.server_principals WHERE name = 'maxnoah'
    `);
    
    if (loginCheck.recordset[0].count > 0) {
      // Update existing login password
      await pool.request().query(`
        ALTER LOGIN maxnoah WITH PASSWORD = '${escapedPassword}';
      `);
      console.log('Login password updated');
    } else {
      // Create new login
      await pool.request().query(`
        CREATE LOGIN maxnoah WITH PASSWORD = '${escapedPassword}';
      `);
      console.log('Login created');
    }
    console.log('Login created or already exists');

    // Switch to flight_booking_db and create user
    try {
      const dbPool = await sql.connect({
        ...config,
        database: 'flight_booking_db',
      });
      
      const userCheck = await dbPool.request().query(`
        SELECT COUNT(*) as count FROM sys.database_principals WHERE name = 'maxnoah'
      `);
      
      if (userCheck.recordset[0].count === 0) {
        await dbPool.request().query(`
          CREATE USER maxnoah FOR LOGIN maxnoah;
          ALTER ROLE db_owner ADD MEMBER maxnoah;
        `);
        console.log('User created in database');
      } else {
        console.log('User already exists in database');
      }
      
      await dbPool.close();
    } catch (error) {
      console.error('Error creating user in database:', error.message);
      throw error;
    }

    await pool.close();
    return true;
  } catch (error) {
    console.error('Error creating database and user:', error);
    return false;
  }
}

async function runMigrations() {
  console.log('Running TypeORM migrations...');
  try {
    // Import TypeORM DataSource and run migrations programmatically
    // This works better in Docker environment
    const typeorm = require('typeorm');
    const dataSource = require('../dist/shared/config/typeorm').default;
    
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log('TypeORM DataSource initialized');
    }
    
    const migrations = await dataSource.runMigrations();
    
    if (migrations && migrations.length > 0) {
      console.log(`Executed ${migrations.length} migration(s):`);
      migrations.forEach(migration => {
        console.log(`  - ${migration.name}`);
      });
    } else {
      console.log('No pending migrations, database is up to date');
    }
    
    await dataSource.destroy();
    console.log('Migrations executed successfully');
    return true;
  } catch (error) {
    console.error('Error running migrations:', error.message);
    console.error('Error details:', error);
    // Check if it's just "no migrations pending" error
    if (error.message && (
      error.message.includes('No migrations') ||
      error.message.includes('already been executed')
    )) {
      console.log('No pending migrations, database is up to date');
      return true;
    }
    return false;
  }
}

async function main() {
  const dbCreated = await createDatabaseAndUser();
  if (!dbCreated) {
    process.exit(1);
  }

  const migrationsRun = await runMigrations();
  if (!migrationsRun) {
    console.warn('Migration execution had issues, but continuing...');
  }

  console.log('Database initialization completed!');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

