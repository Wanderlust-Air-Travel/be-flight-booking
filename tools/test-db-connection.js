/**
 * Script test kết nối database
 * Chạy: node test-db-connection.js
 */

require('dotenv').config();
const sql = require('mssql');

const config = {
	server: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT || '1433', 10),
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME,
	options: {
		encrypt: process.env.DB_ENCRYPT === 'true',
		trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
		enableArithAbort: true,
	},
	connectionTimeout: 10000,
	requestTimeout: 10000,
};

console.log('🔍 Testing database connection...');
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
	.connect(config)
	.then((pool) => {
		console.log('✅ Connection successful!');
		console.log('');
		return pool.request().query('SELECT @@VERSION AS Version, DB_NAME() AS CurrentDatabase, SUSER_SNAME() AS CurrentUser');
	})
	.then((result) => {
		console.log('Database Info:');
		console.log(`  Current Database: ${result.recordset[0].CurrentDatabase}`);
		console.log(`  Current User: ${result.recordset[0].CurrentUser}`);
		console.log('');
		console.log('✅ Test completed successfully!');
		process.exit(0);
	})
	.catch((err) => {
		console.error('❌ Connection failed!');
		console.error('');
		console.error('Error details:');
		console.error(`  Code: ${err.code || 'N/A'}`);
		console.error(`  Message: ${err.message || 'N/A'}`);
		console.error('');
		
		if (err.code === 'ELOGIN') {
			console.error('🔴 Login failed! Possible causes:');
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
		} else if (err.code === 'ETIMEOUT' || err.code === 'ECONNREFUSED') {
			console.error('🔴 Connection timeout or refused!');
			console.error('  1. Check SQL Server is running');
			console.error('  2. Check host and port in .env');
			console.error('  3. Check firewall settings');
		} else {
			console.error('🔴 Unknown error!');
			console.error('  Check error message above for details');
		}
		
		process.exit(1);
	});

