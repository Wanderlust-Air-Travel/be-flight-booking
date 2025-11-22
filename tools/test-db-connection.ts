/**
 * Script test kết nối database
 * Chạy: ts-node -r tsconfig-paths/register tools/test-db-connection.ts
 * Hoặc: npm run test:db
 */

import * as dotenv from 'dotenv';
import * as sql from 'mssql';
import { SqlConfig } from 'src/shared/types/database/sql-config.interface';

dotenv.config();

interface DatabaseInfo {
	Version: string;
	CurrentDatabase: string;
	CurrentUser: string;
}

const config: SqlConfig = {
	server: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT || '1434', 10),
	user: process.env.DB_USER || '',
	password: process.env.DB_PASS || '',
	database: process.env.DB_NAME,
	options: {
		encrypt: process.env.DB_ENCRYPT === 'true',
		trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
		enableArithAbort: true,
	},
	connectionTimeout: 10000,
	requestTimeout: 10000,
};

console.log('Testing database connection...');
console.log('');
console.log('Configuration:');
console.log(`  Server: ${config.server}`);
console.log(`  Port: ${config.port}`);
console.log(`  User: ${config.user}`);
console.log(`  Database: ${config.database}`);
console.log(`  Encrypt: ${config.options.encrypt}`);
console.log(`  Trust Certificate: ${config.options.trustServerCertificate}`);
console.log('');

sql
	.connect(config as sql.config)
	.then((pool: sql.ConnectionPool) => {
		console.log('Connection successful!');
		console.log('');
		return pool.request().query<DatabaseInfo>(
			'SELECT @@VERSION AS Version, DB_NAME() AS CurrentDatabase, SUSER_SNAME() AS CurrentUser',
		);
	})
	.then((result: sql.IResult<DatabaseInfo>) => {
		console.log('Database Info:');
		console.log(`  Current Database: ${result.recordset[0].CurrentDatabase}`);
		console.log(`  Current User: ${result.recordset[0].CurrentUser}`);
		console.log('');
		console.log('Test completed successfully!');
		process.exit(0);
	})
	.catch((err: sql.ConnectionError | sql.RequestError | Error) => {
		console.error('Connection failed!');
		console.error('');
		console.error('Error details:');
		
		const errorCode = (err as sql.ConnectionError | sql.RequestError).code || 'N/A';
		const errorMessage = err.message || 'N/A';
		
		console.error(`  Code: ${errorCode}`);
		console.error(`  Message: ${errorMessage}`);
		console.error('');

		if (errorCode === 'ELOGIN') {
			console.error('Login failed! Possible causes:');
			console.error('  1. SQL Server Authentication is not enabled (Windows Auth only)');
			console.error('  2. Wrong username or password');
			console.error('  3. Login is disabled');
			console.error('');
			console.error('Solutions:');
			console.error('  1. Check SQL Server Authentication Mode:');
			console.error('     - Run: sql/utils/check-auth-mode.sql');
			console.error('     - If Windows Auth only, enable Mixed Mode in SQL Server Configuration Manager');
			console.error('  2. Reset password:');
			console.error('     - Run: sql/utils/fix-login-issues.sql');
			console.error('  3. Check .env file has correct credentials');
		} else if (errorCode === 'ETIMEOUT' || errorCode === 'ECONNREFUSED') {
			console.error('Connection timeout or refused!');
			console.error('  1. Check SQL Server is running');
			console.error('  2. Check host and port in .env');
			console.error('  3. Check firewall settings');
		} else {
			console.error('Unknown error!');
			console.error('  Check error message above for details');
		}

		process.exit(1);
	});

