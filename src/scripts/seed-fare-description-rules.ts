import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'path';
import { FareDescriptionRule } from '../shared/entities/fare/fare-description-rule.entity';

// Load .env file
config({ path: resolve(process.cwd(), '.env') });

const ds = new DataSource({
	type: 'mssql',
	host: process.env.DB_HOST,
	port: Number(process.env.DB_PORT ?? 1434),
	username: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME,
	options: { encrypt: process.env.DB_ENCRYPT === 'true' },
	extra: { trustServerCertificate: process.env.DB_TRUST_CERT === 'true' },
	entities: [FareDescriptionRule],
	synchronize: false,
});

/**
 * Seed fare description rules from hard-coded logic
 */
async function seedFareDescriptionRules() {
	console.log('Starting fare description rules seed...');

	try {
		await ds.initialize();
		console.log('Database connected');

		const ruleRepo = ds.getRepository(FareDescriptionRule);

		// Check if rules already exist
		const existingCount = await ruleRepo.count();
		if (existingCount > 0) {
			console.log(`\nFound ${existingCount} existing rules. Skipping seed.`);
			console.log('To re-seed, delete existing rules first.');
			return;
		}

		console.log('\nInserting fare description rules...');

		const rules: Partial<FareDescriptionRule>[] = [];

		// Default rule for all fare classes
		rules.push({
			fare_class_code_pattern: 'DEFAULT',
			cabin_type: 'economy',
			description_text: 'Hành lý xách tay: 7kg',
			status: true,
			display_order: 0,
			is_active: true,
			is_default: true,
		});

		rules.push({
			fare_class_code_pattern: 'DEFAULT',
			cabin_type: 'business',
			description_text: 'Hành lý xách tay: 7kg',
			status: true,
			display_order: 0,
			is_active: true,
			is_default: true,
		});

		// Economy: SMX/SAVER
		rules.push({
			fare_class_code_pattern: 'SMX',
			cabin_type: 'economy',
			description_text: 'Không bao gồm hành lý ký gửi',
			status: false,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SAVER',
			cabin_type: 'economy',
			description_text: 'Không bao gồm hành lý ký gửi',
			status: false,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SMX',
			cabin_type: 'economy',
			description_text: 'Không được hoàn/hủy',
			status: false,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SAVER',
			cabin_type: 'economy',
			description_text: 'Không được hoàn/hủy',
			status: false,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SMX',
			cabin_type: 'economy',
			description_text: 'Thay đổi trước giờ khởi hành: 600.000 VND (*)',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SAVER',
			cabin_type: 'economy',
			description_text: 'Thay đổi trước giờ khởi hành: 600.000 VND (*)',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SMX',
			cabin_type: 'economy',
			description_text: 'Không thay đổi sau giờ khởi hành (*)',
			status: false,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SAVER',
			cabin_type: 'economy',
			description_text: 'Không thay đổi sau giờ khởi hành (*)',
			status: false,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SMX',
			cabin_type: 'economy',
			description_text: 'Hệ số cộng điểm Bamboo Club: 0.25',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SAVER',
			cabin_type: 'economy',
			description_text: 'Hệ số cộng điểm Bamboo Club: 0.25',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SMX',
			cabin_type: 'economy',
			description_text: 'Chọn ghế ngồi mất phí',
			status: false,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SAVER',
			cabin_type: 'economy',
			description_text: 'Chọn ghế ngồi mất phí',
			status: false,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SMX',
			cabin_type: 'economy',
			description_text: 'Không áp dụng cho go-show',
			status: false,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SAVER',
			cabin_type: 'economy',
			description_text: 'Không áp dụng cho go-show',
			status: false,
			display_order: 7,
			is_active: true,
			is_default: false,
		});

		// Economy: Y
		rules.push({
			fare_class_code_pattern: 'Y',
			cabin_type: 'economy',
			description_text: 'Không bao gồm hành lý ký gửi',
			status: false,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'Y',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy trước giờ khởi hành: 400.000 VND (*)',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'Y',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy sau giờ khởi hành: 400.000 VND (*)',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'Y',
			cabin_type: 'economy',
			description_text: 'Thay đổi trước giờ khởi hành: 500.000 VND (*)',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'Y',
			cabin_type: 'economy',
			description_text: 'Thay đổi sau giờ khởi hành: 500.000 VND (*)',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'Y',
			cabin_type: 'economy',
			description_text: 'Hệ số cộng điểm Bamboo Club: 0.5',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'Y',
			cabin_type: 'economy',
			description_text: 'Chọn ghế ngồi mất phí',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'Y',
			cabin_type: 'economy',
			description_text: 'Không áp dụng cho go-show',
			status: false,
			display_order: 8,
			is_active: true,
			is_default: false,
		});

		// Economy: SM or YS
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'economy',
			description_text: 'Không bao gồm hành lý ký gửi',
			status: false,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YS',
			cabin_type: 'economy',
			description_text: 'Không bao gồm hành lý ký gửi',
			status: false,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy trước giờ khởi hành: 450.000 VND (*)',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YS',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy trước giờ khởi hành: 450.000 VND (*)',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy sau giờ khởi hành: 600.000 VND (*)',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YS',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy sau giờ khởi hành: 600.000 VND (*)',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'economy',
			description_text: 'Thay đổi trước giờ khởi hành: 450.000 VND (*)',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YS',
			cabin_type: 'economy',
			description_text: 'Thay đổi trước giờ khởi hành: 450.000 VND (*)',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'economy',
			description_text: 'Thay đổi sau giờ khởi hành: 600.000 VND (*)',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YS',
			cabin_type: 'economy',
			description_text: 'Thay đổi sau giờ khởi hành: 600.000 VND (*)',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'economy',
			description_text: 'Hệ số cộng điểm Bamboo Club: 0.5',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YS',
			cabin_type: 'economy',
			description_text: 'Hệ số cộng điểm Bamboo Club: 0.5',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'economy',
			description_text: 'Chọn ghế ngồi mất phí',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YS',
			cabin_type: 'economy',
			description_text: 'Chọn ghế ngồi mất phí',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'economy',
			description_text: 'Không áp dụng cho go-show',
			status: false,
			display_order: 8,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YS',
			cabin_type: 'economy',
			description_text: 'Không áp dụng cho go-show',
			status: false,
			display_order: 8,
			is_active: true,
			is_default: false,
		});

		// Economy: FLX/FLEX/YF
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'economy',
			description_text: '01 kiện hành lý ký gửi 20kg',
			status: true,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'economy',
			description_text: '01 kiện hành lý ký gửi 20kg',
			status: true,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YF',
			cabin_type: 'economy',
			description_text: '01 kiện hành lý ký gửi 20kg',
			status: true,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy trước giờ khởi hành: 300.000 VND (*)',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy trước giờ khởi hành: 300.000 VND (*)',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YF',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy trước giờ khởi hành: 300.000 VND (*)',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy sau giờ khởi hành: 300.000 VND (*)',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy sau giờ khởi hành: 300.000 VND (*)',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YF',
			cabin_type: 'economy',
			description_text: 'Hoàn/hủy sau giờ khởi hành: 300.000 VND (*)',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'economy',
			description_text: 'Thay đổi miễn phí',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'economy',
			description_text: 'Thay đổi miễn phí',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YF',
			cabin_type: 'economy',
			description_text: 'Thay đổi miễn phí',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'economy',
			description_text: 'Hệ số cộng điểm Bamboo Club: 1.00',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'economy',
			description_text: 'Hệ số cộng điểm Bamboo Club: 1.00',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YF',
			cabin_type: 'economy',
			description_text: 'Hệ số cộng điểm Bamboo Club: 1.00',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'economy',
			description_text: 'Chọn ghế ngồi miễn phí',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'economy',
			description_text: 'Chọn ghế ngồi miễn phí',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YF',
			cabin_type: 'economy',
			description_text: 'Chọn ghế ngồi miễn phí',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'economy',
			description_text: 'Đổi chuyến tại sân bay miễn phí',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'economy',
			description_text: 'Đổi chuyến tại sân bay miễn phí',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'YF',
			cabin_type: 'economy',
			description_text: 'Đổi chuyến tại sân bay miễn phí',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});

		// Business: J
		rules.push({
			fare_class_code_pattern: 'J',
			cabin_type: 'business',
			description_text: '01 kiện hành lý ký gửi 30kg',
			status: true,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'J',
			cabin_type: 'business',
			description_text: 'Hoàn/hủy trước giờ khởi hành: 400.000 VND (*)',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'J',
			cabin_type: 'business',
			description_text: 'Hoàn/hủy sau giờ khởi hành: 400.000 VND (*)',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'J',
			cabin_type: 'business',
			description_text: 'Thay đổi trước giờ khởi hành: 350.000 VND (*)',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'J',
			cabin_type: 'business',
			description_text: 'Thay đổi sau giờ khởi hành: 350.000 VND (*)',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'J',
			cabin_type: 'business',
			description_text: 'Hệ số cộng điểm Bamboo Club: 1.5',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'J',
			cabin_type: 'business',
			description_text: 'Chọn ghế ngồi miễn phí',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'J',
			cabin_type: 'business',
			description_text: 'Ưu tiên check-in và lên máy bay',
			status: true,
			display_order: 8,
			is_active: true,
			is_default: false,
		});

		// Business: SM or JS
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'business',
			description_text: '01 kiện hành lý ký gửi 30kg',
			status: true,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JS',
			cabin_type: 'business',
			description_text: '01 kiện hành lý ký gửi 30kg',
			status: true,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'business',
			description_text: 'Hoàn/hủy trước giờ khởi hành: 450.000 VND (*)',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JS',
			cabin_type: 'business',
			description_text: 'Hoàn/hủy trước giờ khởi hành: 450.000 VND (*)',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'business',
			description_text: 'Hoàn/hủy sau giờ khởi hành: 800.000 VND (*)',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JS',
			cabin_type: 'business',
			description_text: 'Hoàn/hủy sau giờ khởi hành: 800.000 VND (*)',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'business',
			description_text: 'Thay đổi trước giờ khởi hành: 300.000 VND (*)',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JS',
			cabin_type: 'business',
			description_text: 'Thay đổi trước giờ khởi hành: 300.000 VND (*)',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'business',
			description_text: 'Thay đổi sau giờ khởi hành: 800.000 VND (*)',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JS',
			cabin_type: 'business',
			description_text: 'Thay đổi sau giờ khởi hành: 800.000 VND (*)',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'business',
			description_text: 'Hệ số cộng điểm Bamboo Club: 1.5',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JS',
			cabin_type: 'business',
			description_text: 'Hệ số cộng điểm Bamboo Club: 1.5',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'business',
			description_text: 'Chọn ghế ngồi miễn phí',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JS',
			cabin_type: 'business',
			description_text: 'Chọn ghế ngồi miễn phí',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'SM',
			cabin_type: 'business',
			description_text: 'Ưu tiên check-in và lên máy bay',
			status: true,
			display_order: 8,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JS',
			cabin_type: 'business',
			description_text: 'Ưu tiên check-in và lên máy bay',
			status: true,
			display_order: 8,
			is_active: true,
			is_default: false,
		});

		// Business: FLX/FLEX/JF
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'business',
			description_text: '02 kiện hành lý ký gửi 30kg',
			status: true,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'business',
			description_text: '02 kiện hành lý ký gửi 30kg',
			status: true,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JF',
			cabin_type: 'business',
			description_text: '02 kiện hành lý ký gửi 30kg',
			status: true,
			display_order: 1,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'business',
			description_text: 'Hoàn/hủy miễn phí',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'business',
			description_text: 'Hoàn/hủy miễn phí',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JF',
			cabin_type: 'business',
			description_text: 'Hoàn/hủy miễn phí',
			status: true,
			display_order: 2,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'business',
			description_text: 'Thay đổi miễn phí',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'business',
			description_text: 'Thay đổi miễn phí',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JF',
			cabin_type: 'business',
			description_text: 'Thay đổi miễn phí',
			status: true,
			display_order: 3,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'business',
			description_text: 'Hệ số cộng điểm Bamboo Club: 2.00',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'business',
			description_text: 'Hệ số cộng điểm Bamboo Club: 2.00',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JF',
			cabin_type: 'business',
			description_text: 'Hệ số cộng điểm Bamboo Club: 2.00',
			status: true,
			display_order: 4,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'business',
			description_text: 'Chọn ghế ngồi miễn phí',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'business',
			description_text: 'Chọn ghế ngồi miễn phí',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JF',
			cabin_type: 'business',
			description_text: 'Chọn ghế ngồi miễn phí',
			status: true,
			display_order: 5,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'business',
			description_text: 'Đổi chuyến tại sân bay miễn phí',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'business',
			description_text: 'Đổi chuyến tại sân bay miễn phí',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JF',
			cabin_type: 'business',
			description_text: 'Đổi chuyến tại sân bay miễn phí',
			status: true,
			display_order: 6,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'business',
			description_text: 'Ưu tiên check-in và lên máy bay',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'business',
			description_text: 'Ưu tiên check-in và lên máy bay',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JF',
			cabin_type: 'business',
			description_text: 'Ưu tiên check-in và lên máy bay',
			status: true,
			display_order: 7,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLX',
			cabin_type: 'business',
			description_text: 'Phòng chờ thương gia',
			status: true,
			display_order: 8,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'FLEX',
			cabin_type: 'business',
			description_text: 'Phòng chờ thương gia',
			status: true,
			display_order: 8,
			is_active: true,
			is_default: false,
		});
		rules.push({
			fare_class_code_pattern: 'JF',
			cabin_type: 'business',
			description_text: 'Phòng chờ thương gia',
			status: true,
			display_order: 8,
			is_active: true,
			is_default: false,
		});

		// Insert all rules
		await ruleRepo.save(rules);

		console.log(`\n✓ Successfully inserted ${rules.length} fare description rules`);
	} catch (error) {
		console.error('Error seeding fare description rules:', error);
		throw error;
	} finally {
		if (ds.isInitialized) {
			await ds.destroy();
		}
	}
}

// Run seed
seedFareDescriptionRules()
	.then(() => {
		console.log('\nSeed completed successfully');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\nSeed failed:', error);
		process.exit(1);
	});

