/**
 * Script test - download ảnh cho 10 routes đầu tiên
 * Để test xem script có hoạt động không
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { Route } from 'src/shared/entities/route/route.entity';
import { Airport } from 'src/shared/entities/airport/airport.entity';

config({ path: resolve(process.cwd(), '.env') });

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
	},
	entities: [Route, Airport],
	synchronize: false,
});

const IMAGES_DIR = join(process.cwd(), 'public', 'images', 'routes');
const IMAGE_WIDTH = 1920;
const IMAGE_HEIGHT = 1080;

async function downloadImage(routeId: string): Promise<boolean> {
	const filePath = join(IMAGES_DIR, `${routeId}.jpg`);
	
	if (existsSync(filePath)) {
		console.log(`   Đã tồn tại: ${routeId}.jpg`);
		return true;
	}

	const seed = routeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
	const url = `https://picsum.photos/${IMAGE_WIDTH}/${IMAGE_HEIGHT}?random=${seed}`;

	try {
		console.log(`   Downloading...`);
		const response = await axios.get(url, {
			responseType: 'arraybuffer',
			timeout: 30000,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			},
			maxRedirects: 5,
		});

		if (response.status === 200 && response.data && response.data.length > 0) {
			await writeFile(filePath, response.data);
			const sizeKB = (response.data.length / 1024).toFixed(2);
			console.log(`   Đã lưu: ${routeId}.jpg (${sizeKB} KB)`);
			return true;
		}
	} catch (error: any) {
		console.log(`   Lỗi: ${error.message}`);
		return false;
	}

	return false;
}

async function main() {
	console.log('Test download ảnh (10 routes đầu tiên)...\n');

	if (!existsSync(IMAGES_DIR)) {
		await mkdir(IMAGES_DIR, { recursive: true });
	}

	try {
		await ds.initialize();
		const routes = await ds
			.createQueryBuilder(Route, 'route')
			.innerJoinAndSelect('route.origin_airport', 'origin')
			.innerJoinAndSelect('route.destination_airport', 'destination')
			.where('route.is_domestic = :domestic', { domestic: true })
			.take(10) // Chỉ lấy 10 routes đầu tiên
			.getMany();

		console.log(`Test với ${routes.length} routes:\n`);

		for (let i = 0; i < routes.length; i++) {
			const route = routes[i];
			console.log(`[${i + 1}/${routes.length}] ${route.origin_airport.iata_code} → ${route.destination_airport.iata_code}`);
			await downloadImage(route.route_id);
			await new Promise(resolve => setTimeout(resolve, 1000));
		}

		console.log('\nTest hoàn tất!');
	} catch (error: any) {
		console.error('Lỗi:', error.message);
	} finally {
		if (ds.isInitialized) {
			await ds.destroy();
		}
	}
}

main().catch(console.error);

