/**
 * Script tự động download ảnh phong cảnh cho deals API
 * 
 * Script này sẽ:
 * 1. Kết nối database và lấy danh sách route_id
 * 2. Download ảnh phong cảnh từ Unsplash (không cần API key)
 * 3. Lưu vào public/images/routes/ với tên {route_id}.jpg
 * 
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/download-deals-images.ts
 * 
 * Hoặc với tsx:
 *   npx tsx scripts/download-deals-images.ts
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

// Load .env file
config({ path: resolve(process.cwd(), '.env') });

// Database connection
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
	entities: [Route, Airport],
	synchronize: false,
});

const IMAGES_DIR = join(process.cwd(), 'public', 'images', 'routes');
const IMAGE_WIDTH = 1920;
const IMAGE_HEIGHT = 1080;

// Không cần keywords nữa vì sử dụng Lorem Picsum với seed từ route_id

/**
 * Download image from Lorem Picsum (random landscape images)
 * Lorem Picsum không cần key, format: https://picsum.photos/{width}/{height}?random={seed}
 */
async function downloadImage(routeId: string, retryCount = 3): Promise<boolean> {
	const filePath = join(IMAGES_DIR, `${routeId}.jpg`);
	
	// Skip nếu file đã tồn tại
	if (existsSync(filePath)) {
		console.log(`   Đã tồn tại: ${routeId}.jpg`);
		return true;
	}

	// Sử dụng routeId như seed để mỗi route có ảnh riêng (nhưng consistent)
	// Convert UUID thành số để dùng làm seed
	const seed = routeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
	const url = `https://picsum.photos/${IMAGE_WIDTH}/${IMAGE_HEIGHT}?random=${seed}`;

	for (let attempt = 1; attempt <= retryCount; attempt++) {
		try {
			console.log(`   Downloading (attempt ${attempt}/${retryCount})...`);
			
			const response = await axios.get(url, {
				responseType: 'arraybuffer',
				timeout: 30000, // 30 seconds
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
			if (attempt < retryCount) {
				console.log(`   Lỗi (attempt ${attempt}): ${error.message}, retrying...`);
				// Wait before retry
				await new Promise(resolve => setTimeout(resolve, 2000));
			} else {
				console.log(`   Lỗi sau ${retryCount} lần thử: ${error.message}`);
			}
		}
	}

	return false;
}

/**
 * Get all domestic routes from database
 */
async function getRoutes(): Promise<Array<{ route_id: string; origin: string; destination: string }>> {
	await ds.initialize();
	console.log('Đã kết nối database\n');

	const routes = await ds
		.createQueryBuilder(Route, 'route')
		.innerJoinAndSelect('route.origin_airport', 'origin')
		.innerJoinAndSelect('route.destination_airport', 'destination')
		.where('route.is_domestic = :domestic', { domestic: true })
		.getMany();

	return routes.map(route => ({
		route_id: route.route_id,
		origin: `${route.origin_airport.iata_code} (${route.origin_airport.city})`,
		destination: `${route.destination_airport.iata_code} (${route.destination_airport.city})`,
	}));
}

/**
 * Main function
 */
async function main() {
	console.log('Bắt đầu download ảnh phong cảnh cho deals API...\n');

	// Ensure images directory exists
	if (!existsSync(IMAGES_DIR)) {
		await mkdir(IMAGES_DIR, { recursive: true });
		console.log(`Đã tạo thư mục: ${IMAGES_DIR}\n`);
	}

	try {
		// Get routes from database
		const routes = await getRoutes();
		
		if (routes.length === 0) {
			console.log('Không tìm thấy route nào trong database!');
			return;
		}

		console.log(`Tìm thấy ${routes.length} routes nội địa:\n`);
		
		// Count existing images
		const existingImages = routes.filter(r => 
			existsSync(join(IMAGES_DIR, `${r.route_id}.jpg`))
		).length;

		console.log(`   - Đã có: ${existingImages} ảnh`);
		console.log(`   - Cần download: ${routes.length - existingImages} ảnh\n`);
		console.log('─'.repeat(60));

		// Download images
		let successCount = 0;
		let skipCount = 0;
		let failCount = 0;

		for (let i = 0; i < routes.length; i++) {
			const route = routes[i];
			console.log(`\n[${i + 1}/${routes.length}] ${route.origin} → ${route.destination}`);
			console.log(`   Route ID: ${route.route_id}`);

			const exists = existsSync(join(IMAGES_DIR, `${route.route_id}.jpg`));
			if (exists) {
				skipCount++;
				continue;
			}

			const success = await downloadImage(route.route_id);
			if (success) {
				successCount++;
			} else {
				failCount++;
			}

			// Delay giữa các request để tránh rate limit (giảm xuống 1 giây cho Lorem Picsum)
			if (i < routes.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
			}
		}

		// Summary
		console.log('\n' + '─'.repeat(60));
		console.log('Tổng kết:');
		console.log(`   Thành công: ${successCount} ảnh`);
		console.log(`   Đã có sẵn: ${skipCount} ảnh`);
		console.log(`   Thất bại: ${failCount} ảnh`);
		console.log(`   Tổng cộng: ${successCount + skipCount}/${routes.length} ảnh`);
		console.log('─'.repeat(60));
		console.log('\nLưu ý:');
		console.log('   - Ảnh được lưu tại: public/images/routes/');
		console.log('   - Format: {route_id}.jpg');
		console.log('   - Kích thước: 1920x1080 (16:9)');
		console.log('   - Nguồn: Lorem Picsum (random landscape images)');
		console.log('   - Mỗi route_id có ảnh riêng (dựa trên seed từ route_id)');
		console.log('\nHoàn tất!');

	} catch (error: any) {
		console.error('\nLỗi:', error.message);
		if (error.stack) {
			console.error(error.stack);
		}
		process.exit(1);
	} finally {
		if (ds.isInitialized) {
			await ds.destroy();
		}
	}
}

// Run script
main().catch((error) => {
	console.error('Lỗi không mong đợi:', error);
	process.exit(1);
});

