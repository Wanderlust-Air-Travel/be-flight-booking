/**
 * Script wrapper để chạy seed chỉ khi database trống
 * 
 * Script này sẽ:
 * 1. Check xem database đã có seed data chưa
 * 2. Nếu chưa có, chạy seed script
 * 3. Nếu đã có, skip seed và thông báo
 * 
 * Usage:
 *   npm run seed:if-empty
 *   hoặc trong Docker: npm run seed:if-empty
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { spawn } from 'child_process';

// Load .env file
config({ path: resolve(process.cwd(), '.env') });

// Use minimal DataSource config - only for connection, not for entities
// We'll use raw SQL queries to avoid loading all entity metadata
const ds = new DataSource({
	type: 'mssql',
	host: process.env.DB_HOST ?? 'localhost',
	port: Number(process.env.DB_PORT ?? 1434),
	username: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME,
	options: {
		encrypt: process.env.DB_ENCRYPT === 'true',
		trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
		enableArithAbort: true,
	},
	extra: {
		requestTimeout: 120000,
		connectionTimeout: 60000,
		pool: {
			max: 10,
			min: 0,
			idleTimeoutMillis: 30000,
		},
	},
	// No entities needed - we use raw SQL queries
	entities: [],
	synchronize: false,
});

/**
 * Check if database already has seed data using raw SQL queries
 * This avoids loading all entity metadata and relations
 */
async function hasExistingSeedData(): Promise<boolean> {
	let isInitialized = false;
	try {
		if (!ds.isInitialized) {
			await ds.initialize();
			isInitialized = true;
		}
		
		// Use raw SQL queries to check table counts
		// This avoids TypeORM entity metadata loading issues
		const queryRunner = ds.createQueryRunner();
		
		const userCountResult = await queryRunner.query('SELECT COUNT(*) as count FROM dbo.Users');
		const routeCountResult = await queryRunner.query('SELECT COUNT(*) as count FROM dbo.Routes');
		const scheduleCountResult = await queryRunner.query('SELECT COUNT(*) as count FROM dbo.FlightSchedules');
		const instanceCountResult = await queryRunner.query('SELECT COUNT(*) as count FROM dbo.FlightInstances');
		
		await queryRunner.release();

		const userCount = userCountResult[0]?.count ?? 0;
		const routeCount = routeCountResult[0]?.count ?? 0;
		const scheduleCount = scheduleCountResult[0]?.count ?? 0;
		const instanceCount = instanceCountResult[0]?.count ?? 0;

		if (userCount > 0 || routeCount > 0 || scheduleCount > 0 || instanceCount > 0) {
			console.log('\nDatabase đã có dữ liệu seed:');
			console.log(`   - Users: ${userCount}`);
			console.log(`   - Routes: ${routeCount}`);
			console.log(`   - Flight Schedules: ${scheduleCount}`);
			console.log(`   - Flight Instances: ${instanceCount}`);
			return true;
		}

		return false;
	} catch (error: any) {
		console.error('Lỗi khi kiểm tra database:', error.message);
		throw error;
	} finally {
		// Only destroy if we initialized it
		if (isInitialized && ds.isInitialized) {
			await ds.destroy();
		}
	}
}

/**
 * Run seed script
 */
async function runSeedScript(): Promise<void> {
	console.log('\nBắt đầu seed database...\n');
	
	// Use npm run seed:full (TypeScript version) for development
	// In production/Docker, use npm run seed-db (compiled JS version)
	const fs = await import('fs');
	const isProduction = process.env.NODE_ENV === 'production' || 
		!fs.existsSync('src/scripts/seed-full-database.ts');
	
	const command = 'npm';
	const args = isProduction 
		? ['run', 'seed-db']
		: ['run', 'seed:full'];
	
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, {
			stdio: 'inherit',
			cwd: process.cwd(),
			shell: true,
		});
		
		proc.on('error', (error: Error) => {
			console.error('Lỗi khi chạy seed script:', error);
			reject(error);
		});
		
		proc.on('exit', (code: number | null) => {
			if (code === 0) {
				console.log('\nSeed database hoàn tất!\n');
				resolve();
			} else {
				console.error(`\nSeed script exited with code ${code}`);
				reject(new Error(`Seed script failed with exit code ${code}`));
			}
		});
	});
}

/**
 * Main function
 */
async function main() {
	try {
		console.log('Kiểm tra dữ liệu seed hiện có...');
		
		const hasData = await hasExistingSeedData();
		
		if (hasData) {
			console.log('\nDatabase đã có dữ liệu seed, bỏ qua seed script.');
			console.log('   Nếu muốn seed lại, hãy:');
			console.log('   1. Xóa dữ liệu seed hiện có (chạy SQL: sql/utils/data-management/clear-all-seed-data.sql)');
			console.log('   2. Hoặc xóa và tạo lại database');
			process.exit(0);
		}
		
		console.log('Database trống, tiếp tục seed...');
		
		await runSeedScript();
		
		process.exit(0);
	} catch (error: any) {
		console.error('\nLỗi:', error.message);
		if (error.stack) {
			console.error(error.stack);
		}
		process.exit(1);
	}
}

// Run
main().catch((error) => {
	console.error('Lỗi không mong đợi:', error);
	process.exit(1);
});

