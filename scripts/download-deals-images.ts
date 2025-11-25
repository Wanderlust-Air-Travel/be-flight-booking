/**
 * Script tự động download ảnh phong cảnh cho deals API
 * 
 * Script này sẽ:
 * 1. Gọi deals API để lấy top 8 deals (FE chỉ hiển thị 8 items)
 * 2. Extract route_id từ image URL của mỗi deal
 * 3. Xóa tất cả ảnh cũ trong public/images/routes/
 * 4. Download ảnh phong cảnh từ Lorem Picsum cho 8 route_id đó
 * 5. Lưu vào public/images/routes/ với tên {route_id}.jpg
 * 
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/download-deals-images.ts
 * 
 * Hoặc với tsx:
 *   npx tsx scripts/download-deals-images.ts
 * 
 * Lưu ý: Backend API phải đang chạy để script có thể gọi deals API
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';
import { writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// Load .env file
config({ path: resolve(process.cwd(), '.env') });

const IMAGES_DIR = join(process.cwd(), 'public', 'images', 'routes');
const IMAGE_WIDTH = 1920;
const IMAGE_HEIGHT = 1080;
const DEALS_LIMIT = 8; // FE chỉ hiển thị 8 items

// Backend API URL - có thể override bằng env variable
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Không cần keywords nữa vì sử dụng Lorem Picsum với seed từ route_id

/**
 * Download image from Lorem Picsum (random landscape images)
 * Lorem Picsum không cần key, format: https://picsum.photos/{width}/{height}?random={seed}
 */
async function downloadImage(routeId: string, retryCount = 3): Promise<boolean> {
	const filePath = join(IMAGES_DIR, `${routeId}.jpg`);
	
	// Không cần skip nữa vì đã xóa hết ảnh cũ ở đầu script
	// Nhưng vẫn check để tránh download lại nếu script bị gián đoạn và chạy lại
	if (existsSync(filePath)) {
		console.log(`   Đã tồn tại: ${routeId}.jpg (skip)`);
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
 * Wait for API Gateway to be ready
 * Retry với exponential backoff
 */
async function waitForApiGateway(maxRetries = 30, initialDelay = 2000): Promise<boolean> {
	// Health endpoint is at /api/v1/health (due to global prefix 'api' and versioning)
	const healthUrl = `${API_BASE_URL}/api/v1/health`;
	
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await axios.get(healthUrl, {
				timeout: 5000,
			});
			
			if (response.status === 200) {
				console.log(`   API Gateway đã sẵn sàng\n`);
				return true;
			}
		} catch (error: any) {
			// Ignore errors, continue retrying
		}
		
		if (attempt < maxRetries) {
			const delay = initialDelay * Math.pow(1.5, attempt - 1); // Exponential backoff
			console.log(`   Đang đợi API Gateway... (attempt ${attempt}/${maxRetries}, retry sau ${Math.round(delay/1000)}s)`);
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}
	
	return false;
}

/**
 * Get top 8 deals from deals API
 * Extract route_id từ image URL của mỗi deal
 * Format image URL: /images/routes/{route_id}.jpg
 */
async function getTopDealsRoutes(): Promise<Array<{ route_id: string; title: string; image: string }>> {
	const dealsUrl = `${API_BASE_URL}/api/v1/services/deals`;
	
	// Đợi API Gateway sẵn sàng trước
	console.log(`Đang kiểm tra API Gateway: ${API_BASE_URL}/api/v1/health`);
	const apiReady = await waitForApiGateway();
	
	if (!apiReady) {
		throw new Error(`API Gateway không sẵn sàng sau nhiều lần thử. Đảm bảo backend đang chạy tại ${API_BASE_URL}`);
	}
	
	try {
		console.log(`Đang gọi deals API: ${dealsUrl}\n`);
		
		const response = await axios.get(dealsUrl, {
			timeout: 30000,
		});

		if (!response.data || !response.data.deals || !Array.isArray(response.data.deals)) {
			throw new Error('Invalid response from deals API: response.data.deals is not an array');
		}

		const deals = response.data.deals;
		console.log(`Nhận được ${deals.length} deals từ API\n`);

		if (deals.length === 0) {
			console.log('Cảnh báo: API trả về 0 deals. Có thể chưa có dữ liệu flights trong database.');
			return [];
		}

		// Lấy top 8 deals (đã được sort theo price từ backend)
		const topDeals = deals.slice(0, DEALS_LIMIT);
		console.log(`Chọn top ${topDeals.length} deals để download ảnh:\n`);

		// Extract route_id từ image URL
		// Format: /images/routes/{route_id}.jpg
		const routes: Array<{ route_id: string; title: string; image: string }> = [];

		for (const deal of topDeals) {
			if (!deal.image) {
				console.log(`   Deal "${deal.title || 'Unknown'}" không có image URL, bỏ qua`);
				continue;
			}

			// Extract route_id từ image path
			// Format: /images/routes/{route_id}.jpg hoặc /images/routes/{route_id}
			const imageMatch = deal.image.match(/\/images\/routes\/([^\/\.]+)/);
			if (!imageMatch || !imageMatch[1]) {
				console.log(`   Không thể extract route_id từ image URL: ${deal.image}`);
				continue;
			}

			const routeId = imageMatch[1];
			routes.push({
				route_id: routeId,
				title: deal.title || `Route ${routeId}`,
				image: deal.image,
			});

			console.log(`   ${deal.title || `Route ${routeId}`}`);
			console.log(`     Route ID: ${routeId}`);
			console.log(`     Image: ${deal.image}\n`);
		}

		return routes;
	} catch (error: any) {
		console.error(`\nLỗi khi gọi deals API:`);
		console.error(`   URL: ${dealsUrl}`);
		console.error(`   Message: ${error.message}`);
		
		if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
			console.error(`   Không thể kết nối đến API Gateway tại ${API_BASE_URL}`);
			console.error(`   Đảm bảo:`);
			console.error(`      1. Backend đang chạy (npm run start:all hoặc docker-compose up)`);
			console.error(`      2. API Gateway đang listen trên port 3000`);
			console.error(`      3. Nếu chạy trong Docker, đảm bảo script chạy SAU khi API Gateway khởi động`);
		} else if (error.response) {
			console.error(`   Status: ${error.response.status}`);
			console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
		} else if (error.request) {
			console.error(`   Không nhận được response từ server`);
		}
		
		throw new Error(`Không thể lấy deals từ API. Xem chi tiết lỗi ở trên.`);
	}
}

/**
 * Delete all old images in the routes directory
 * Vì mỗi lần seed DB là generate data mới, route_id mới, nên ảnh cũ không còn tác dụng
 */
async function deleteOldImages(): Promise<number> {
	if (!existsSync(IMAGES_DIR)) {
		return 0;
	}

	try {
		const files = await readdir(IMAGES_DIR);
		const imageFiles = files.filter(file => 
			file.toLowerCase().endsWith('.jpg') || 
			file.toLowerCase().endsWith('.jpeg') || 
			file.toLowerCase().endsWith('.png')
		);

		let deletedCount = 0;
		for (const file of imageFiles) {
			const filePath = join(IMAGES_DIR, file);
			try {
				await unlink(filePath);
				deletedCount++;
			} catch (error: any) {
				console.log(`   Cảnh báo: Không thể xóa ${file}: ${error.message}`);
			}
		}

		return deletedCount;
	} catch (error: any) {
		console.log(`   Cảnh báo: Không thể đọc thư mục ${IMAGES_DIR}: ${error.message}`);
		return 0;
	}
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
	} else {
		// Xóa tất cả ảnh cũ trước khi download ảnh mới
		console.log('Đang xóa ảnh cũ...');
		const deletedCount = await deleteOldImages();
		if (deletedCount > 0) {
			console.log(`   Đã xóa ${deletedCount} ảnh cũ\n`);
		} else {
			console.log('   Không có ảnh cũ để xóa\n');
		}
	}

	try {
		// Get top 8 deals from deals API (FE chỉ hiển thị 8 items)
		const routes = await getTopDealsRoutes();
		
		if (routes.length === 0) {
			console.log('Không tìm thấy deals nào từ API hoặc không thể extract route_id!');
			console.log('   Đảm bảo:');
			console.log('   1. Backend API đang chạy tại', API_BASE_URL);
			console.log('   2. Deals API trả về ít nhất 1 deal có image URL hợp lệ');
			return;
		}

		console.log(`\nTổng kết:`);
		console.log(`   - Tìm thấy: ${routes.length} deals có ảnh hợp lệ`);
		console.log(`   - Cần download: ${routes.length} ảnh\n`);
		console.log('─'.repeat(60));

		// Download images
		let successCount = 0;
		let skipCount = 0;
		let failCount = 0;

		for (let i = 0; i < routes.length; i++) {
			const route = routes[i];
			console.log(`\n[${i + 1}/${routes.length}] ${route.title}`);
			console.log(`   Route ID: ${route.route_id}`);

			const exists = existsSync(join(IMAGES_DIR, `${route.route_id}.jpg`));
			if (exists) {
				console.log(`   Đã tồn tại: ${route.route_id}.jpg (skip)`);
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
		console.log(`   Đã có sẵn (skip): ${skipCount} ảnh`);
		console.log(`   Thất bại: ${failCount} ảnh`);
		console.log(`   Tổng cộng: ${successCount + skipCount}/${routes.length} ảnh`);
		console.log('─'.repeat(60));
		console.log('\nLưu ý:');
		console.log('   - Ảnh được lưu tại: public/images/routes/');
		console.log('   - Format: {route_id}.jpg');
		console.log('   - Kích thước: 1920x1080 (16:9)');
		console.log('   - Nguồn: Lorem Picsum (random landscape images)');
		console.log('   - Mỗi route_id có ảnh riêng (dựa trên seed từ route_id)');
		console.log('   - Ảnh cũ đã được xóa tự động trước khi download ảnh mới');
		console.log('   - Chỉ download ảnh cho top 8 deals (FE chỉ hiển thị 8 items)');
		console.log('   - Routes được lấy từ deals API (dựa theo các chuyến bay có hỗ trợ)');
		console.log('\nHoàn tất!');

	} catch (error: any) {
		console.error('\nLỗi:', error.message);
		if (error.stack) {
			console.error(error.stack);
		}
		process.exit(1);
	}
}

// Run script
main().catch((error) => {
	console.error('Lỗi không mong đợi:', error);
	process.exit(1);
});

