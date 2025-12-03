/* eslint-disable no-console */
import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import * as bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';

// Load .env file from project root
config({ path: resolve(process.cwd(), '.env') });

import { DataSource } from 'typeorm';
import { Airport } from 'src/shared/entities/airport/airport.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { AircraftType } from 'src/shared/entities/aircraft/aircraft-type.entity';
import { Aircraft } from 'src/shared/entities/aircraft/aircraft.entity';
import { CabinClass } from 'src/shared/entities/cabin/cabin-class.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { BaggageAllowance } from 'src/shared/entities/fare/baggage-allowance.entity';
import { CabinService } from 'src/shared/entities/cabin/cabin-service.entity';
import { SeatConfiguration } from 'src/shared/entities/seat/seat-configuration.entity';
import { User } from 'src/shared/entities/user/user.entity';
import { Passenger } from 'src/shared/entities/passenger/passenger.entity';
import { Role } from 'src/shared/entities/role/role.entity';
import { UserRole } from 'src/shared/entities/user/user-role.entity';
import { SystemRole } from 'src/shared/constants/roles';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { PaymentMethod } from 'src/shared/entities/payment/payment-method.entity';
import { Reservation } from 'src/shared/entities/reservation/reservation.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { BookingPassenger } from 'src/shared/entities/booking/booking-passenger.entity';
import { BookingSegment } from 'src/shared/entities/booking/booking-segment.entity';
import { Ticket } from 'src/shared/entities/ticket/ticket.entity';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import {
	SEAT_COLUMNS,
	SEAT_DISTRIBUTION,
	generateSeatNumber,
	getSeatType,
} from 'src/shared/constants/seat.constants';

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
		requestTimeout: 120000, // 120 seconds (2 minutes) for mssql driver
		connectionTimeout: 60000, // 60 seconds
		pool: {
			max: 10,
			min: 0,
			idleTimeoutMillis: 30000,
		},
	},
	entities: [
		Airport, Route, FlightSchedule, FlightInstance, FlightSeat,
		AircraftType, Aircraft, CabinClass, FareClass, SeatConfiguration,
		User, Passenger, Role, UserRole, Currency, PaymentMethod, Reservation,
		Booking, BookingPassenger, BookingSegment, Ticket, Payment,
		RouteFarePrice, BaggageAllowance, CabinService,
	],
	synchronize: false,
});

// Helper functions
function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(array: T[]): T {
	return array[Math.floor(Math.random() * array.length)];
}

function randomDate(start: Date, end: Date): Date {
	return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generatePNR(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let result = '';
	for (let i = 0; i < 6; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

function generateTicketNumber(): string {
	const airline = randomElement(['BBO', 'VNA', 'VJ', 'QH']);
	const number = String(randomInt(100000, 999999));
	return `${airline}${number}`;
}

function generateVietnameseName(): string {
	const firstNames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vu', 'Vo', 'Dang', 'Bui', 'Do'];
	const middleNames = ['Van', 'Thi', 'Duc', 'Minh', 'Thanh', 'Quang', 'Duy', 'Hoang', 'Tuan', 'Anh'];
	const lastNames = ['Anh', 'Binh', 'Cuong', 'Dung', 'Giang', 'Hoa', 'Khanh', 'Linh', 'Mai', 'Nam', 'Oanh', 'Phuong', 'Quang', 'Son', 'Thao'];
	return `${randomElement(firstNames)} ${randomElement(middleNames)} ${randomElement(lastNames)}`;
}

function generateEmail(fullname: string): string {
	const name = fullname.toLowerCase().replace(/\s+/g, '');
	const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'vn.vn'];
	return `${name}${randomInt(1, 9999)}@${randomElement(domains)}`;
}

function generatePhone(): string {
	const prefixes = ['090', '091', '092', '093', '094', '096', '097', '098', '032', '033', '034', '035', '036', '037', '038', '039'];
	return `${randomElement(prefixes)}${String(randomInt(1000000, 9999999))}`;
}

function generateDocumentNumber(): string {
	return String(randomInt(100000000, 999999999));
}

/**
 * Check if database already has seed data
 * Returns true if data exists, false otherwise
 */
async function hasExistingSeedData(ds: DataSource): Promise<boolean> {
	const repos = {
		user: ds.getRepository(User),
		route: ds.getRepository(Route),
		schedule: ds.getRepository(FlightSchedule),
		instance: ds.getRepository(FlightInstance),
	};

	// Check for existing seed data in key tables
	// Seed script creates:
	// - 500 users
	// - Multiple routes (domestic routes between airports)
	// - Flight schedules
	// - Flight instances
	
	const userCount = await repos.user.count();
	const routeCount = await repos.route.count();
	const scheduleCount = await repos.schedule.count();
	const instanceCount = await repos.instance.count();

	// If any of these tables have data, assume database has been seeded
	if (userCount > 0 || routeCount > 0 || scheduleCount > 0 || instanceCount > 0) {
		console.log('\nDatabase đã có dữ liệu seed:');
		console.log(`   - Users: ${userCount}`);
		console.log(`   - Routes: ${routeCount}`);
		console.log(`   - Flight Schedules: ${scheduleCount}`);
		console.log(`   - Flight Instances: ${instanceCount}`);
		return true;
	}

	return false;
}

async function run() {
	console.log('Starting full database seed...');
	
	try {
		await ds.initialize();
		console.log('Database connected');
		
		// Test connection with a simple query and set command timeout
		console.log('Testing connection...');
		const queryRunner = ds.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.query('SELECT 1 as test');
		await queryRunner.release();
		console.log('Connection test successful');
	} catch (error) {
		console.error('Database connection failed:', error);
		console.error('Error details:', error);
		throw error;
	}

	// Check if database already has seed data
	console.log('\nKiểm tra dữ liệu seed hiện có...');
	const hasData = await hasExistingSeedData(ds);
	
	if (hasData) {
		console.error('\nLỗi: Database đã có dữ liệu seed!');
		console.error('   Để chạy lại seed script, bạn cần:');
		console.error('   1. Xóa dữ liệu seed hiện có (chạy SQL script: sql/utils/data-management/clear-all-seed-data.sql)');
		console.error('   2. Hoặc xóa và tạo lại database');
		console.error('\n   Script sẽ dừng để tránh duplicate data.');
		await ds.destroy();
		process.exit(1);
	}

	console.log('Database trống, có thể tiếp tục seed...\n');

	const repos = {
		airport: ds.getRepository(Airport),
		route: ds.getRepository(Route),
		schedule: ds.getRepository(FlightSchedule),
		instance: ds.getRepository(FlightInstance),
		seat: ds.getRepository(FlightSeat),
		aircraftType: ds.getRepository(AircraftType),
		aircraft: ds.getRepository(Aircraft),
		cabinClass: ds.getRepository(CabinClass),
		fareClass: ds.getRepository(FareClass),
		seatConfig: ds.getRepository(SeatConfiguration),
		user: ds.getRepository(User),
		passenger: ds.getRepository(Passenger),
		currency: ds.getRepository(Currency),
		paymentMethod: ds.getRepository(PaymentMethod),
		reservation: ds.getRepository(Reservation),
		booking: ds.getRepository(Booking),
		bookingPassenger: ds.getRepository(BookingPassenger),
		bookingSegment: ds.getRepository(BookingSegment),
		ticket: ds.getRepository(Ticket),
		payment: ds.getRepository(Payment),
		role: ds.getRepository(Role),
		userRole: ds.getRepository(UserRole),
		routeFarePrice: ds.getRepository(RouteFarePrice),
		baggageAllowance: ds.getRepository(BaggageAllowance),
		cabinService: ds.getRepository(CabinService),
	};

	// ============================================================
	// 1. CURRENCIES & PAYMENT METHODS
	// ============================================================
	console.log('\nSeeding Currencies and Payment Methods...');
	
	const currencies = [
		{ currency_code: 'VND', name: 'Vietnamese Dong' },
		{ currency_code: 'USD', name: 'US Dollar' },
		{ currency_code: 'EUR', name: 'Euro' },
	];
	
	// Use try-catch with better error handling
	for (const c of currencies) {
		try {
			const existing = await repos.currency.findOne({ where: { currency_code: c.currency_code } });
			if (!existing) {
				await repos.currency.save(repos.currency.create(c));
				console.log(`  Created currency: ${c.currency_code}`);
			}
		} catch (error) {
			console.error(`  Error with currency ${c.currency_code}:`, error);
			// Continue with next currency instead of failing completely
		}
	}
	
	let vnd;
	try {
		vnd = await repos.currency.findOneByOrFail({ currency_code: 'VND' });
	} catch (error) {
		console.error('Failed to find VND currency. Creating it now...');
		vnd = await repos.currency.save(repos.currency.create({ currency_code: 'VND', name: 'Vietnamese Dong' }));
	}

	// Payment Methods - Match với enum PaymentMethodCode
	const paymentMethods = [
		{ payment_method_code: 'CREDIT_CARD', name: 'Credit Card', is_active: true },
		{ payment_method_code: 'DEBIT_CARD', name: 'Debit Card', is_active: true },
		{ payment_method_code: 'BANK_TRANSFER', name: 'Bank Transfer', is_active: true },
		{ payment_method_code: 'EWALLET', name: 'E-Wallet', is_active: true }, // VNPay, MoMo, ZaloPay, etc.
		{ payment_method_code: 'CASH', name: 'Cash', is_active: true },
	];
	for (const pm of paymentMethods) {
		const existing = await repos.paymentMethod.findOne({ where: { payment_method_code: pm.payment_method_code } });
		if (!existing) {
			await repos.paymentMethod.save(repos.paymentMethod.create(pm));
			console.log(`  Created payment method: ${pm.payment_method_code}`);
		}
	}

	// ============================================================
	// 2. CABIN CLASSES & FARE CLASSES
	// ============================================================
	console.log('\nSeeding Cabin Classes and Fare Classes...');
	
	const cabinClasses = [
		{ cabin_class_code: 'Y', name: 'Economy' },
		{ cabin_class_code: 'J', name: 'Business' },
		{ cabin_class_code: 'F', name: 'First' },
		{ cabin_class_code: 'W', name: 'Premium Economy' },
	];
	for (const cc of cabinClasses) {
		const existing = await repos.cabinClass.findOne({ where: { cabin_class_code: cc.cabin_class_code } });
		if (!existing) await repos.cabinClass.save(repos.cabinClass.create(cc));
	}
	const economyCabin = await repos.cabinClass.findOneByOrFail({ cabin_class_code: 'Y' });
	const businessCabin = await repos.cabinClass.findOneByOrFail({ cabin_class_code: 'J' });

	const fareClasses = [
		// Economy fare classes
		{ fare_class_code: 'YSM', cabin_class: economyCabin, description: 'Economy Saver Max', change_rule: 'Change before departure: 600,000 VND', refund_rule: 'Non-refundable' },
		{ fare_class_code: 'YSMX', cabin_class: economyCabin, description: 'Economy Saver Max Extended', change_rule: 'Change before departure: 600,000 VND', refund_rule: 'Non-refundable' },
		{ fare_class_code: 'YS', cabin_class: economyCabin, description: 'Economy Smart', change_rule: 'Change before departure: 450,000 VND', refund_rule: 'Refund before departure: 450,000 VND' },
		{ fare_class_code: 'YF', cabin_class: economyCabin, description: 'Economy Flex', change_rule: 'Free changes', refund_rule: 'Refund before departure: 300,000 VND' },
		{ fare_class_code: 'YFLX', cabin_class: economyCabin, description: 'Economy Flex Extended', change_rule: 'Free changes', refund_rule: 'Refund before departure: 300,000 VND' },
		{ fare_class_code: 'Y', cabin_class: economyCabin, description: 'Economy Standard', change_rule: 'Change before departure: 500,000 VND', refund_rule: 'Refund before departure: 400,000 VND' },
		// Business fare classes
		{ fare_class_code: 'JS', cabin_class: businessCabin, description: 'Business Smart', change_rule: 'Change before departure: 300,000 VND', refund_rule: 'Refund before departure: 450,000 VND' },
		{ fare_class_code: 'JF', cabin_class: businessCabin, description: 'Business Flex', change_rule: 'Free changes', refund_rule: 'Refund before departure: 300,000 VND' },
		{ fare_class_code: 'JFLX', cabin_class: businessCabin, description: 'Business Flex Extended', change_rule: 'Free changes', refund_rule: 'Refund before departure: 300,000 VND' },
		{ fare_class_code: 'J', cabin_class: businessCabin, description: 'Business Standard', change_rule: 'Change before departure: 350,000 VND', refund_rule: 'Refund before departure: 400,000 VND' },
	];
	for (const fc of fareClasses) {
		const existing = await repos.fareClass.findOne({ where: { fare_class_code: fc.fare_class_code } });
		if (!existing) await repos.fareClass.save(repos.fareClass.create(fc));
	}

	// ============================================================
	// 2.5. BAGGAGE ALLOWANCES
	// ============================================================
	console.log('\nSeeding Baggage Allowances...');
	
	const baggageAllowances = [
		// Economy fare classes
		{ fare_class_code: 'YSM', checked_baggage_kg: null, checked_baggage_pieces: null, carry_on_kg: 7, carry_on_pieces: 1, carry_on_dimensions: '55x40x20', is_domestic: true, is_international: true, notes: 'No checked baggage included' },
		{ fare_class_code: 'YSMX', checked_baggage_kg: null, checked_baggage_pieces: null, carry_on_kg: 7, carry_on_pieces: 1, carry_on_dimensions: '55x40x20', is_domestic: true, is_international: true, notes: 'No checked baggage included' },
		{ fare_class_code: 'Y', checked_baggage_kg: 20, checked_baggage_pieces: 1, carry_on_kg: 7, carry_on_pieces: 1, carry_on_dimensions: '55x40x20', is_domestic: true, is_international: true, notes: '1 piece 20kg checked baggage' },
		{ fare_class_code: 'YS', checked_baggage_kg: 20, checked_baggage_pieces: 1, carry_on_kg: 7, carry_on_pieces: 1, carry_on_dimensions: '55x40x20', is_domestic: true, is_international: true, notes: '1 piece 20kg checked baggage' },
		{ fare_class_code: 'YF', checked_baggage_kg: 30, checked_baggage_pieces: 2, carry_on_kg: 7, carry_on_pieces: 1, carry_on_dimensions: '55x40x20', is_domestic: true, is_international: true, notes: '2 pieces 30kg checked baggage' },
		{ fare_class_code: 'YFLX', checked_baggage_kg: 30, checked_baggage_pieces: 2, carry_on_kg: 7, carry_on_pieces: 1, carry_on_dimensions: '55x40x20', is_domestic: true, is_international: true, notes: '2 pieces 30kg checked baggage' },
		// Business fare classes
		{ fare_class_code: 'J', checked_baggage_kg: 30, checked_baggage_pieces: 2, carry_on_kg: 7, carry_on_pieces: 1, carry_on_dimensions: '55x40x20', is_domestic: true, is_international: true, notes: '2 pieces 30kg checked baggage' },
		{ fare_class_code: 'JS', checked_baggage_kg: 30, checked_baggage_pieces: 2, carry_on_kg: 7, carry_on_pieces: 1, carry_on_dimensions: '55x40x20', is_domestic: true, is_international: true, notes: '2 pieces 30kg checked baggage' },
		{ fare_class_code: 'JF', checked_baggage_kg: 40, checked_baggage_pieces: 2, carry_on_kg: 7, carry_on_pieces: 1, carry_on_dimensions: '55x40x20', is_domestic: true, is_international: true, notes: '2 pieces 40kg checked baggage' },
		{ fare_class_code: 'JFLX', checked_baggage_kg: 40, checked_baggage_pieces: 2, carry_on_kg: 7, carry_on_pieces: 1, carry_on_dimensions: '55x40x20', is_domestic: true, is_international: true, notes: '2 pieces 40kg checked baggage' },
	];

	for (const ba of baggageAllowances) {
		const existing = await repos.baggageAllowance.findOne({ 
			where: { 
				fare_class_code: ba.fare_class_code,
				is_domestic: ba.is_domestic,
				is_international: ba.is_international,
			} 
		});
		if (!existing) {
			await repos.baggageAllowance.save(repos.baggageAllowance.create({
				baggage_allowance_id: uuidv7(),
				...ba,
			}));
		}
	}
	console.log(`Seeded ${baggageAllowances.length} baggage allowances`);

	// ============================================================
	// 2.6. CABIN SERVICES
	// ============================================================
	console.log('\nSeeding Cabin Services...');
	
	const cabinServices = [
		// Economy cabin services (applies to all economy fare classes)
		{ cabin_class_code: 'Y', fare_class_code: null, service_type: 'meal', service_name: 'Snack', description: 'Light snack and beverage', is_included: true, price: null, display_order: 1 },
		{ cabin_class_code: 'Y', fare_class_code: null, service_type: 'entertainment', service_name: 'In-flight Entertainment', description: 'Personal screen with movies and music', is_included: true, price: null, display_order: 2 },
		{ cabin_class_code: 'Y', fare_class_code: null, service_type: 'wifi', service_name: 'WiFi Access', description: 'Available for purchase', is_included: false, price: 200000, display_order: 3 },
		{ cabin_class_code: 'Y', fare_class_code: null, service_type: 'seat_selection', service_name: 'Seat Selection', description: 'Available for purchase', is_included: false, price: 150000, display_order: 4 },
		
		// Economy Flex specific services
		{ cabin_class_code: 'Y', fare_class_code: 'YF', service_type: 'meal', service_name: 'Hot Meal', description: 'Hot meal and beverage', is_included: true, price: null, display_order: 1 },
		{ cabin_class_code: 'Y', fare_class_code: 'YFLX', service_type: 'meal', service_name: 'Hot Meal', description: 'Hot meal and beverage', is_included: true, price: null, display_order: 1 },
		{ cabin_class_code: 'Y', fare_class_code: 'YF', service_type: 'priority_boarding', service_name: 'Priority Boarding', description: 'Board before general boarding', is_included: true, price: null, display_order: 5 },
		{ cabin_class_code: 'Y', fare_class_code: 'YFLX', service_type: 'priority_boarding', service_name: 'Priority Boarding', description: 'Board before general boarding', is_included: true, price: null, display_order: 5 },
		
		// Business cabin services (applies to all business fare classes)
		{ cabin_class_code: 'J', fare_class_code: null, service_type: 'meal', service_name: 'Gourmet Meal', description: 'Multi-course gourmet meal with premium beverages', is_included: true, price: null, display_order: 1 },
		{ cabin_class_code: 'J', fare_class_code: null, service_type: 'entertainment', service_name: 'Premium Entertainment', description: 'Large screen with premium content', is_included: true, price: null, display_order: 2 },
		{ cabin_class_code: 'J', fare_class_code: null, service_type: 'wifi', service_name: 'WiFi Access', description: 'Complimentary WiFi', is_included: true, price: null, display_order: 3 },
		{ cabin_class_code: 'J', fare_class_code: null, service_type: 'seat_selection', service_name: 'Seat Selection', description: 'Complimentary seat selection', is_included: true, price: null, display_order: 4 },
		{ cabin_class_code: 'J', fare_class_code: null, service_type: 'priority_boarding', service_name: 'Priority Boarding', description: 'Priority boarding access', is_included: true, price: null, display_order: 5 },
		{ cabin_class_code: 'J', fare_class_code: null, service_type: 'lounge_access', service_name: 'Lounge Access', description: 'Access to business class lounge', is_included: true, price: null, display_order: 6 },
		{ cabin_class_code: 'J', fare_class_code: null, service_type: 'extra_legroom', service_name: 'Extra Legroom', description: 'More legroom and space', is_included: true, price: null, display_order: 7 },
		
		// Business Flex specific services
		{ cabin_class_code: 'J', fare_class_code: 'JF', service_type: 'meal', service_name: 'Premium Gourmet Meal', description: 'Chef-curated premium meal with fine wines', is_included: true, price: null, display_order: 1 },
		{ cabin_class_code: 'J', fare_class_code: 'JFLX', service_type: 'meal', service_name: 'Premium Gourmet Meal', description: 'Chef-curated premium meal with fine wines', is_included: true, price: null, display_order: 1 },
		{ cabin_class_code: 'J', fare_class_code: 'JF', service_type: 'lounge_access', service_name: 'Premium Lounge Access', description: 'Access to premium lounge with spa services', is_included: true, price: null, display_order: 6 },
		{ cabin_class_code: 'J', fare_class_code: 'JFLX', service_type: 'lounge_access', service_name: 'Premium Lounge Access', description: 'Access to premium lounge with spa services', is_included: true, price: null, display_order: 6 },
	];

	for (const cs of cabinServices) {
		// Build where condition based on nullable fields
		const whereCondition: any = {
			cabin_class_code: cs.cabin_class_code,
			service_type: cs.service_type,
		};
		if (cs.fare_class_code !== null) {
			whereCondition.fare_class_code = cs.fare_class_code;
		} else {
			whereCondition.fare_class_code = null;
		}

		const existing = await repos.cabinService.findOne({ 
			where: whereCondition,
		});
		if (!existing) {
			await repos.cabinService.save(repos.cabinService.create({
				cabin_service_id: uuidv7(),
				...cs,
			}));
		}
	}
	console.log(`Seeded ${cabinServices.length} cabin services`);

	// ============================================================
	// 3. AIRCRAFT TYPES & AIRCRAFTS
	// ============================================================
	console.log('\nSeeding Aircraft Types and Aircrafts...');
	
	const aircraftTypes = [
		{ code: 'A320', manufacturer: 'Airbus', model: 'A320-200', total_seats: 180 },
		{ code: 'A321', manufacturer: 'Airbus', model: 'A321-200', total_seats: 180 },
		{ code: 'A350', manufacturer: 'Airbus', model: 'A350-900', total_seats: 180 },
		{ code: 'B737', manufacturer: 'Boeing', model: '737-800', total_seats: 180 },
		{ code: 'B787', manufacturer: 'Boeing', model: '787-9 Dreamliner', total_seats: 180 },
		{ code: 'ATR72', manufacturer: 'ATR', model: 'ATR 72-600', total_seats: 180 },
	];
	const savedAircraftTypes: AircraftType[] = [];
	for (const at of aircraftTypes) {
		let existing = await repos.aircraftType.findOne({ where: { code: at.code } });
		if (!existing) {
			existing = await repos.aircraftType.save(repos.aircraftType.create({
				...at,
				aircraft_type_id: uuidv7(),
			}));
		}
		savedAircraftTypes.push(existing);
	}

	// Create 100+ aircrafts (more aircrafts for more flight instances)
	const aircrafts: Aircraft[] = [];
	for (let i = 1; i <= 100; i++) {
		const aircraftType = randomElement(savedAircraftTypes);
		const registration = `VN-${aircraftType.code}-${String(i).padStart(3, '0')}`;
		const existing = await repos.aircraft.findOne({ where: { registration } });
		if (!existing) {
			const ac = await repos.aircraft.save(repos.aircraft.create({
				aircraft_id: uuidv7(),
				aircraft_type: aircraftType,
				registration,
				in_service: Math.random() > 0.1, // 90% in service
			}));
			aircrafts.push(ac);
		}
	}
	console.log(`Created ${aircrafts.length} aircrafts`);

	// ============================================================
	// 4. SEAT CONFIGURATIONS (for each aircraft type)
	// ============================================================
	console.log('\nSeeding Seat Configurations...');
	
	for (const aircraftType of savedAircraftTypes) {
		const existing = await repos.seatConfig.count({ where: { aircraft_type: { aircraft_type_id: aircraftType.aircraft_type_id } } });
		if (existing > 0) continue; // Skip if already configured

		const totalSeats = aircraftType.total_seats;
		const businessSeats = Math.floor(totalSeats * SEAT_DISTRIBUTION.BUSINESS_PERCENTAGE);
		const economySeats = totalSeats - businessSeats;

		const seatConfigs: Partial<SeatConfiguration>[] = [];
		
		// Business seats (rows 1-3, typically)
		// Sử dụng constants từ seat.constants.ts
		for (let row = 1; row <= Math.ceil(businessSeats / SEAT_DISTRIBUTION.COLUMNS_PER_ROW); row++) {
			for (const col of SEAT_COLUMNS) {
				if (seatConfigs.length >= businessSeats) break;
				seatConfigs.push({
					aircraft_type: aircraftType,
					seat_number: generateSeatNumber(row, col),
					cabin_class: businessCabin,
					seat_type: getSeatType(col),
					is_exit_row: false,
				});
			}
		}

		// Economy seats
		// Sử dụng constants từ seat.constants.ts
		let row = Math.ceil(businessSeats / SEAT_DISTRIBUTION.COLUMNS_PER_ROW) + 1;
		while (seatConfigs.length < totalSeats) {
			for (const col of SEAT_COLUMNS) {
				if (seatConfigs.length >= totalSeats) break;
				seatConfigs.push({
					aircraft_type: aircraftType,
					seat_number: generateSeatNumber(row, col),
					cabin_class: economyCabin,
					seat_type: getSeatType(col),
					is_exit_row: row % 10 === 0, // Every 10th row is exit row
				});
			}
			row++;
		}

		// Batch insert (reduced batch size to avoid SQL Server 2100 parameter limit)
		// TypeORM save() with array can generate many parameters, so use very small batches
		// Each seat config has ~6 fields, but TypeORM may generate more parameters for relations
		// Using batch size 5 = ~30 parameters per batch (very safe, well below 2100 limit)
		const batchSize = 5;
		for (let i = 0; i < seatConfigs.length; i += batchSize) {
			const batch = seatConfigs.slice(i, i + batchSize);
			const entitiesToSave = batch.map(sc => repos.seatConfig.create({
				...sc,
				seat_config_id: uuidv7(),
			}));
			// Use save() with very small batches to ensure proper relation handling
			await repos.seatConfig.save(entitiesToSave);
		}
		console.log(`Created ${seatConfigs.length} seat configurations for ${aircraftType.code}`);
	}

	// ============================================================
	// 5. AIRPORTS
	// ============================================================
	console.log('\nSeeding Airports...');
	
	const airportsData = [
		// Vietnam domestic airports only - All airports are in Vietnam for domestic flights only
		{ iata_code: 'HAN', icao_code: 'VVNB', name: 'Noi Bai International', city: 'Hanoi', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'SGN', icao_code: 'VVTS', name: 'Tan Son Nhat International', city: 'Ho Chi Minh City', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'DAD', icao_code: 'VVDN', name: 'Da Nang International', city: 'Da Nang', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'CXR', icao_code: 'VVCR', name: 'Cam Ranh International', city: 'Nha Trang', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'PQC', icao_code: 'VVPQ', name: 'Phu Quoc International', city: 'Phu Quoc', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'HUI', icao_code: 'VVPH', name: 'Phu Bai International', city: 'Hue', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'VCA', icao_code: 'VVCT', name: 'Can Tho International', city: 'Can Tho', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'HPH', icao_code: 'VVCI', name: 'Cat Bi International', city: 'Hai Phong', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'VDO', icao_code: 'VVVD', name: 'Van Don International', city: 'Quang Ninh', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'THD', icao_code: 'VVTX', name: 'Tho Xuan', city: 'Thanh Hoa', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'VII', icao_code: 'VVVH', name: 'Vinh', city: 'Vinh', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'DIN', icao_code: 'VVDB', name: 'Dien Bien Phu', city: 'Dien Bien', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'VCL', icao_code: 'VVCA', name: 'Chu Lai', city: 'Chu Lai', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'UIH', icao_code: 'VVPC', name: 'Phu Cat', city: 'Quy Nhon', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'TBB', icao_code: 'VVTH', name: 'Dong Tac', city: 'Tuy Hoa', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'PXU', icao_code: 'VVPK', name: 'Pleiku', city: 'Pleiku', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'BMV', icao_code: 'VVBM', name: 'Buon Ma Thuot', city: 'Buon Ma Thuot', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'DLI', icao_code: 'VVDL', name: 'Lien Khuong', city: 'Da Lat', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'CAH', icao_code: 'VVCM', name: 'Ca Mau', city: 'Ca Mau', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'VKG', icao_code: 'VVRG', name: 'Rach Gia', city: 'Rach Gia', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
	];
	
	const savedAirports: Airport[] = [];
	for (const ap of airportsData) {
		let existing = await repos.airport.findOne({ where: { iata_code: ap.iata_code } });
		if (!existing) {
			existing = await repos.airport.save(repos.airport.create({
				...ap,
				airport_id: uuidv7(),
			}));
		}
		savedAirports.push(existing);
	}
	console.log(`Created ${savedAirports.length} airports`);

	// ============================================================
	// 6. ROUTES
	// ============================================================
	console.log('\nSeeding Routes...');
	
	const routes: Route[] = [];
	// Distance map for domestic routes only (all airports are in Vietnam)
	const distances: Record<string, number> = {
		// Major routes
		'HAN-SGN': 1150, 'SGN-HAN': 1150,
		'HAN-DAD': 610, 'DAD-HAN': 610,
		'SGN-DAD': 600, 'DAD-SGN': 600,
		'HAN-HPH': 120, 'HPH-HAN': 120,
		'SGN-VCA': 170, 'VCA-SGN': 170,
		'SGN-PQC': 300, 'PQC-SGN': 300,
		'SGN-CXR': 400, 'CXR-SGN': 400,
		'HAN-VDO': 150, 'VDO-HAN': 150,
		'HAN-HUI': 650, 'HUI-HAN': 650,
		'HAN-VII': 300, 'VII-HAN': 300,
		'HAN-THD': 150, 'THD-HAN': 150,
		'SGN-DLI': 300, 'DLI-SGN': 300,
		'SGN-UIH': 500, 'UIH-SGN': 500,
		'SGN-TBB': 450, 'TBB-SGN': 450,
		'SGN-BMV': 350, 'BMV-SGN': 350,
		'SGN-PXU': 400, 'PXU-SGN': 400,
		'SGN-VKG': 200, 'VKG-SGN': 200,
		'SGN-CAH': 250, 'CAH-SGN': 250,
		'DAD-HUI': 100, 'HUI-DAD': 100,
		'DAD-CXR': 200, 'CXR-DAD': 200,
		'DAD-UIH': 250, 'UIH-DAD': 250,
		'DAD-VCL': 100, 'VCL-DAD': 100,
		'CXR-DLI': 150, 'DLI-CXR': 150,
		'DAD-DLI': 200, 'DLI-DAD': 200,
		'HAN-DIN': 450, 'DIN-HAN': 450,
	};

	// Create routes between all Vietnam airports (domestic only)
	// All airports are in Vietnam, so all routes are domestic
	let routesCreated = 0;
	for (const origin of savedAirports) {
		for (const dest of savedAirports) {
			if (origin.airport_id === dest.airport_id) continue;
			
			// Only create routes between Vietnam airports (all airports are Vietnam)
			if (origin.country !== 'Vietnam' || dest.country !== 'Vietnam') {
				continue; // Skip if not Vietnam (should not happen, but safety check)
			}
			
			const key = `${origin.iata_code}-${dest.iata_code}`;
			// Use predefined distance or calculate based on typical Vietnam domestic flight distances (200-1200 km)
			const distance = distances[key] || randomInt(200, 1200);
			const isDomestic = true; // All routes are domestic since all airports are in Vietnam

			const existing = await repos.route
				.createQueryBuilder('route')
				.where('route.origin_airport_id = :origin', { origin: origin.airport_id })
				.andWhere('route.destination_airport_id = :dest', { dest: dest.airport_id })
				.getOne();

			if (!existing) {
				const route = await repos.route.save(repos.route.create({
					route_id: uuidv7(),
					origin_airport: origin,
					destination_airport: dest,
					distance_km: distance,
					is_domestic: isDomestic,
				}));
				routes.push(route);
				routesCreated++;
			} else {
				// Load existing route into array
				routes.push(existing);
			}
		}
	}
	console.log(`Created ${routesCreated} new routes, total: ${routes.length} routes`);

	// ============================================================
	// 6.5. ROUTE FARE PRICES (Seed prices for all routes and fare classes)
	// ============================================================
	console.log('\nSeeding Route Fare Prices...');
	
	// Get all fare classes
	const allFareClasses = await repos.fareClass.find({ relations: ['cabin_class'] });
	
	// Pricing structure based on fare class and cabin type
	const pricingStructure: Record<string, { basePrice: number; taxRate: number; feeRate: number }> = {
		// Economy fare classes
		'YSMX': { basePrice: 1448000, taxRate: 0.1, feeRate: 0.05 },
		'YSM': { basePrice: 1448000, taxRate: 0.1, feeRate: 0.05 },
		'Y': { basePrice: 1577000, taxRate: 0.1, feeRate: 0.05 },
		'YS': { basePrice: 1577000, taxRate: 0.1, feeRate: 0.05 },
		'YF': { basePrice: 3068000, taxRate: 0.1, feeRate: 0.05 },
		'YFLX': { basePrice: 3068000, taxRate: 0.1, feeRate: 0.05 },
		// Business fare classes
		'J': { basePrice: 5022000, taxRate: 0.1, feeRate: 0.05 },
		'JS': { basePrice: 5022000, taxRate: 0.1, feeRate: 0.05 },
		'JF': { basePrice: 7074000, taxRate: 0.1, feeRate: 0.05 },
		'JFLX': { basePrice: 7074000, taxRate: 0.1, feeRate: 0.05 },
	};

	// Default pricing for unknown fare classes
	const getDefaultPricing = (cabinClassCode: string) => {
		if (cabinClassCode === 'Y') {
			return { basePrice: 1577000, taxRate: 0.1, feeRate: 0.05 }; // Economy default
		} else if (cabinClassCode === 'J') {
			return { basePrice: 5022000, taxRate: 0.1, feeRate: 0.05 }; // Business default
		}
		return { basePrice: 1577000, taxRate: 0.1, feeRate: 0.05 }; // Fallback
	};

	let pricesCreated = 0;
	const today = new Date();
	const effectiveFrom = new Date(today.getFullYear(), today.getMonth(), 1); // First day of current month
	const effectiveTo = new Date(today.getFullYear() + 1, 11, 31); // End of next year

	// Create prices for each route and fare class combination
	for (const route of routes) {
		for (const fareClass of allFareClasses) {
			try {
				// Check if price already exists
				const existing = await repos.routeFarePrice.findOne({
					where: {
						route_id: route.route_id,
						fare_class_code: fareClass.fare_class_code,
					},
				});

				if (existing) {
					continue; // Skip if already exists
				}

				// Get pricing from structure or use default
				const fareClassCode = fareClass.fare_class_code.toUpperCase();
				const pricing = pricingStructure[fareClassCode] || getDefaultPricing(fareClass.cabin_class.cabin_class_code);

				// Create route fare price
				const routeFarePrice = repos.routeFarePrice.create({
					route_fare_price_id: uuidv7(),
					route_id: route.route_id,
					fare_class_code: fareClass.fare_class_code,
					base_price: pricing.basePrice,
					tax_rate: pricing.taxRate,
					fee_rate: pricing.feeRate,
					effective_from: effectiveFrom,
					effective_to: effectiveTo,
					is_active: true,
					priority: 0,
					notes: `Default price for ${fareClass.fare_class_code} on route ${route.route_id}`,
				});

				await repos.routeFarePrice.save(routeFarePrice);
				pricesCreated++;
			} catch (error: any) {
				console.error(
					`  Error creating price for route ${route.route_id}, fare class ${fareClass.fare_class_code}:`,
					error.message,
				);
			}
		}
	}

	console.log(`Created ${pricesCreated} route fare prices`);

	// ============================================================
	// 7. USERS & PASSENGERS
	// ============================================================
	console.log('\nSeeding Users and Passengers...');
	
	const passwordHash = await bcrypt.hash('Password123!', 10);
	const users: User[] = [];
	const totalUsers = 500;
	let createdCount = 0;
	let skippedCount = 0;

	console.log(`  Creating up to ${totalUsers} users...`);
	
	for (let i = 0; i < totalUsers; i++) {
		try {
			const fullname = generateVietnameseName();
			const email = generateEmail(fullname);
			const phone = generatePhone();

			const existing = await repos.user.findOne({ where: { email } });
			if (!existing) {
				const user = await repos.user.save(repos.user.create({
					user_id: uuidv7(),
					fullname,
					email,
					password_hash: passwordHash,
					phone,
					is_active: Math.random() > 0.05, // 95% active
				}));
				users.push(user);
				createdCount++;

				// Create 1-3 passengers per user
				const numPassengers = randomInt(1, 3);
				for (let j = 0; j < numPassengers; j++) {
					try {
						const passengerName = j === 0 ? fullname : generateVietnameseName();
						const dob = randomDate(new Date(1950, 0, 1), new Date(2010, 11, 31));
						const gender = randomElement(['Male', 'Female']);
						const documentNumber = generateDocumentNumber();

						await repos.passenger.save(repos.passenger.create({
							passenger_id: uuidv7(),
							user,
							fullname: passengerName,
							dob,
							gender,
							document_number: documentNumber,
							loyalty_number: Math.random() > 0.7 ? `LOY${randomInt(100000, 999999)}` : null,
						}));
					} catch (passengerError: any) {
						console.error(`  Error creating passenger for user ${email}:`, passengerError.message);
						// Continue with next passenger
					}
				}

				// Progress logging every 50 users
				if (createdCount % 50 === 0) {
					console.log(`  Progress: Created ${createdCount} users, skipped ${skippedCount} duplicates...`);
				}
			} else {
				skippedCount++;
			}
		} catch (userError: any) {
			console.error(`  Error creating user ${i + 1}:`, userError.message);
			// Continue with next user
		}
	}
	
	console.log(`  Completed: Created ${createdCount} users, skipped ${skippedCount} duplicates`);
	console.log(`Created ${users.length} users with passengers`);

	// ============================================================
	// 7.5. ASSIGN ROLES TO USERS
	// ============================================================
	console.log('\nAssigning roles to users...');
	
	// Get all roles from database
	const allRoles = await repos.role.find();
	const rolesMap = new Map<string, Role>();
	allRoles.forEach(role => {
		rolesMap.set(role.role_code, role);
	});

	// Ensure CUSTOMER role exists
	const customerRole = rolesMap.get(SystemRole.CUSTOMER);
	if (!customerRole) {
		console.error('  ERROR: CUSTOMER role not found in database. Please run migrations first.');
	} else {
		// Assign CUSTOMER role to all users (default role)
		console.log('  Assigning CUSTOMER role to all users...');
		let customerAssigned = 0;
		for (const user of users) {
			try {
				const existing = await repos.userRole.findOne({
					where: { user_id: user.user_id, role_code: SystemRole.CUSTOMER }
				});
				if (!existing) {
					await repos.userRole.save(repos.userRole.create({
						user_id: user.user_id,
						role_code: SystemRole.CUSTOMER,
					}));
					customerAssigned++;
				}
			} catch (error: any) {
				console.error(`  Error assigning CUSTOMER role to user ${user.email}:`, error.message);
			}
		}
		console.log(`  Assigned CUSTOMER role to ${customerAssigned} users`);
	}

	// Create specific users with specific roles for testing
	console.log('\n  Creating test users with specific roles...');
	const testUsers: Array<{ email: string; fullname: string; phone: string; roles: SystemRole[] }> = [
		{
			email: 'admin@flightbooking.com',
			fullname: 'System Administrator',
			phone: '0900000001',
			roles: [SystemRole.ADMIN, SystemRole.CUSTOMER]
		},
		{
			email: 'revenue.analyst@flightbooking.com',
			fullname: 'Revenue Analyst',
			phone: '0900000002',
			roles: [SystemRole.REVENUE_ANALYST, SystemRole.CUSTOMER]
		},
		{
			email: 'schedule.planner@flightbooking.com',
			fullname: 'Schedule Planner',
			phone: '0900000003',
			roles: [SystemRole.SCHEDULE_PLANNER, SystemRole.CUSTOMER]
		},
		{
			email: 'call.center@flightbooking.com',
			fullname: 'Call Center Staff',
			phone: '0900000004',
			roles: [SystemRole.CALL_CENTER, SystemRole.CUSTOMER]
		},
		{
			email: 'ancillary.manager@flightbooking.com',
			fullname: 'Ancillary Manager',
			phone: '0900000005',
			roles: [SystemRole.ANCILLARY_MANAGER, SystemRole.CUSTOMER]
		},
		{
			email: 'accounting@flightbooking.com',
			fullname: 'Accounting Staff',
			phone: '0900000006',
			roles: [SystemRole.ACCOUNTING_STAFF, SystemRole.CUSTOMER]
		},
		{
			email: 'distribution.manager@flightbooking.com',
			fullname: 'Distribution Manager',
			phone: '0900000007',
			roles: [SystemRole.DISTRIBUTION_MANAGER, SystemRole.CUSTOMER]
		},
		{
			email: 'fraud.analyst@flightbooking.com',
			fullname: 'Fraud Analyst',
			phone: '0900000008',
			roles: [SystemRole.FRAUD_ANALYST, SystemRole.CUSTOMER]
		},
		{
			email: 'travel.agent@flightbooking.com',
			fullname: 'Travel Agent',
			phone: '0900000009',
			roles: [SystemRole.TRAVEL_AGENT, SystemRole.CUSTOMER]
		},
		{
			email: 'multi.role@flightbooking.com',
			fullname: 'Multi Role User',
			phone: '0900000010',
			roles: [SystemRole.REVENUE_ANALYST, SystemRole.SCHEDULE_PLANNER, SystemRole.CUSTOMER]
		}
	];

	let testUsersCreated = 0;
	let testUsersSkipped = 0;

	for (const testUserData of testUsers) {
		try {
			// Check if user already exists
			let user = await repos.user.findOne({ where: { email: testUserData.email } });
			
			if (!user) {
				// Create new user
				user = await repos.user.save(repos.user.create({
					user_id: uuidv7(),
					fullname: testUserData.fullname,
					email: testUserData.email,
					password_hash: passwordHash,
					phone: testUserData.phone,
					is_active: true,
				}));
				testUsersCreated++;
				console.log(`    Created test user: ${testUserData.email}`);
			} else {
				testUsersSkipped++;
				console.log(`    Test user already exists: ${testUserData.email}`);
			}

			// Assign roles to user
			for (const roleCode of testUserData.roles) {
				try {
					const role = rolesMap.get(roleCode);
					if (!role) {
						console.error(`    ERROR: Role ${roleCode} not found in database`);
						continue;
					}

					const existing = await repos.userRole.findOne({
						where: { user_id: user.user_id, role_code: roleCode }
					});

					if (!existing) {
						await repos.userRole.save(repos.userRole.create({
							user_id: user.user_id,
							role_code: roleCode,
						}));
						console.log(`      Assigned role ${roleCode} to ${testUserData.email}`);
					}
				} catch (roleError: any) {
					console.error(`    Error assigning role ${roleCode} to ${testUserData.email}:`, roleError.message);
				}
			}

			// Create a passenger for test user
			try {
				const existingPassenger = await repos.passenger.findOne({
					where: { user: { user_id: user.user_id } }
				});
				if (!existingPassenger) {
					await repos.passenger.save(repos.passenger.create({
						passenger_id: uuidv7(),
						user,
						fullname: testUserData.fullname,
						dob: randomDate(new Date(1980, 0, 1), new Date(1995, 11, 31)),
						gender: randomElement(['Male', 'Female']),
						document_number: generateDocumentNumber(),
					}));
				}
			} catch (passengerError: any) {
				console.error(`    Error creating passenger for test user ${testUserData.email}:`, passengerError.message);
			}
		} catch (error: any) {
			console.error(`  Error creating test user ${testUserData.email}:`, error.message);
		}
	}

	console.log(`  Test users: Created ${testUsersCreated}, Skipped ${testUsersSkipped}`);
	console.log('  All test users have password: Password123!');

	// Assign random roles to some regular users (for testing)
	console.log('\n  Assigning random roles to regular users (for testing)...');
	const roleCodes = [
		SystemRole.TRAVEL_AGENT,
		SystemRole.CALL_CENTER,
		SystemRole.REVENUE_ANALYST,
		SystemRole.SCHEDULE_PLANNER,
	];
	
	let randomRolesAssigned = 0;
	const usersToAssignRoles = users.slice(0, Math.min(50, users.length)); // Assign to first 50 users
	
	for (const user of usersToAssignRoles) {
		// Skip if user is one of the test users
		if (testUsers.some(tu => tu.email === user.email)) {
			continue;
		}

		// 30% chance to assign an additional role
		if (Math.random() < 0.3) {
			const randomRole = randomElement(roleCodes);
			const role = rolesMap.get(randomRole);
			
			if (role) {
				try {
					const existing = await repos.userRole.findOne({
						where: { user_id: user.user_id, role_code: randomRole }
					});
					
					if (!existing) {
						await repos.userRole.save(repos.userRole.create({
							user_id: user.user_id,
							role_code: randomRole,
						}));
						randomRolesAssigned++;
					}
				} catch (error: any) {
					// Silently continue
				}
			}
		}
	}
	
	console.log(`  Assigned additional roles to ${randomRolesAssigned} regular users`);

	// ============================================================
	// 8. FLIGHT SCHEDULES
	// ============================================================
	console.log('\nSeeding Flight Schedules...');
	
	// Set dates to December 2025 for flight schedules and instances
	// from = 1/12/2025 00:00:00, to = 31/12/2025 23:59:59
	const from = new Date(2025, 11, 1, 0, 0, 0, 0); // December 1, 2025 (month is 0-indexed, so 11 = December)
	const to = new Date(2025, 11, 31, 23, 59, 59, 999); // December 31, 2025
	
	console.log(`  Flight schedules effective period: ${from.toLocaleDateString()} to ${to.toLocaleDateString()}`);

	const flightNumbers = ['BBO', 'VNA', 'VJ', 'QH'];
	const operatingDaysPatterns = [
		'1111111', // Daily - prioritize this for guaranteed flights every day
		'1010101', // Mon, Wed, Fri, Sun
		'0101010', // Tue, Thu, Sat
		'1111100', // Mon-Fri
		'0000011', // Sat-Sun
	];

	const schedules: FlightSchedule[] = [];
	// Create multiple schedules per route for more variety
	// All routes are domestic (Vietnam only)
	const domesticRoutes = routes; // All routes are domestic since all airports are in Vietnam
	
	// Prioritize popular domestic routes (HAN-SGN, HAN-DAD, SGN-DAD, etc.) to ensure they have instances
	const popularRouteCodes = [
		'HAN-SGN', 'SGN-HAN', 
		'HAN-DAD', 'DAD-HAN', 
		'SGN-DAD', 'DAD-SGN', 
		'HAN-HPH', 'HPH-HAN', 
		'SGN-PQC', 'PQC-SGN',
		'SGN-CXR', 'CXR-SGN',
		'HAN-VDO', 'VDO-HAN',
		'SGN-VCA', 'VCA-SGN',
	];
	const popularRoutes: Route[] = [];
	const otherRoutes: Route[] = [];
	
	for (const route of domesticRoutes) {
		// Find origin and destination airports for this route
		const originAirport = savedAirports.find(a => a.airport_id === route.origin_airport_id);
		const destAirport = savedAirports.find(a => a.airport_id === route.destination_airport_id);
		if (originAirport && destAirport) {
			const routeCode = `${originAirport.iata_code}-${destAirport.iata_code}`;
			if (popularRouteCodes.includes(routeCode)) {
				popularRoutes.push(route);
			} else {
				otherRoutes.push(route);
			}
		} else {
			otherRoutes.push(route);
		}
	}
	
	// Combine: popular routes first, then others
	const routesToUse = [...popularRoutes, ...otherRoutes];
	const maxRoutes = Math.min(200, routesToUse.length); // Use up to 200 routes for more flight schedules in December 2025
	
	let schedulesCreated = 0;
	// Track used flight numbers to avoid duplicates within the same period
	const usedFlightNumbers = new Set<string>();
	
	for (const route of routesToUse.slice(0, maxRoutes)) {
		// Create 3-5 schedules per route for more variety in December 2025
		const numSchedules = randomInt(3, 5);
		
		// Ensure at least one daily schedule per route for guaranteed flights every day
		let hasDailySchedule = false;
		
		for (let s = 0; s < numSchedules; s++) {
			const aircraftType = randomElement(savedAircraftTypes);
			// First schedule must be daily to ensure flights every day
			// Subsequent schedules can be random
			const operatingDays = (s === 0 || !hasDailySchedule) 
				? '1111111' // Daily
				: randomElement(operatingDaysPatterns);
			
			if (operatingDays === '1111111') {
				hasDailySchedule = true;
			}

			// Calculate flight duration based on distance
			const distance = route.distance_km || 1000;
			const durationMinutes = Math.floor(distance / 10) + randomInt(30, 120); // ~10km/min + buffer
			const departureHour = randomInt(6, 22);
			const departureMinute = randomInt(0, 59);
			const arrivalTime = new Date(2000, 0, 1, departureHour, departureMinute);
			arrivalTime.setMinutes(arrivalTime.getMinutes() + durationMinutes);

			// Generate unique flight number (retry if duplicate)
			let flightNum: string;
			let attempts = 0;
			const maxAttempts = 10;
			
			do {
				const airline = randomElement(flightNumbers);
				// Generate unique flight number with route identifier
				const routeSuffix = randomInt(100, 999);
				// Use route_id first char to make it more unique
				const routeIdChar = route.route_id.substring(0, 1).toUpperCase();
				flightNum = `${airline}${routeIdChar}${routeSuffix}`;
				attempts++;
				
				// Check if this flight number + period combination already exists
				const existing = await repos.schedule
					.createQueryBuilder('fs')
					.where('fs.flight_number = :flightNum', { flightNum })
					.andWhere('CAST(fs.effective_from AS DATE) = CAST(:from AS DATE)', { from: from.toISOString().slice(0, 10) })
					.andWhere('CAST(fs.effective_to AS DATE) = CAST(:to AS DATE)', { to: to.toISOString().slice(0, 10) })
					.getOne();
				
				if (!existing && !usedFlightNumbers.has(flightNum)) {
					usedFlightNumbers.add(flightNum);
					break;
				}
				
				// If max attempts reached, use timestamp to ensure uniqueness
				if (attempts >= maxAttempts) {
					const timestamp = Date.now().toString().slice(-4);
					flightNum = `${airline}${timestamp}`;
					usedFlightNumbers.add(flightNum);
					break;
				}
			} while (attempts < maxAttempts);

			// Final check before creating
			const finalCheck = await repos.schedule
				.createQueryBuilder('fs')
				.where('fs.flight_number = :flightNum', { flightNum })
				.andWhere('CAST(fs.effective_from AS DATE) = CAST(:from AS DATE)', { from: from.toISOString().slice(0, 10) })
				.andWhere('CAST(fs.effective_to AS DATE) = CAST(:to AS DATE)', { to: to.toISOString().slice(0, 10) })
				.getOne();

			if (!finalCheck) {
				try {
					const schedule = await repos.schedule.save(repos.schedule.create({
						flight_schedule_id: uuidv7(),
						flight_number: flightNum,
						route,
						aircraft_type: aircraftType,
						departure_time_local: `${String(departureHour).padStart(2, '0')}:${String(departureMinute).padStart(2, '0')}`,
						arrival_time_local: `${String(arrivalTime.getHours()).padStart(2, '0')}:${String(arrivalTime.getMinutes()).padStart(2, '0')}`,
						operating_days: operatingDays,
						effective_from: from,
						effective_to: to,
						status: 'active',
					}));
					schedules.push(schedule);
					schedulesCreated++;
				} catch (error: any) {
					// If still duplicate (race condition), skip this schedule
					if (error?.code === 'EREQUEST' && error?.number === 2627) {
						console.log(`  Skipping duplicate schedule: ${flightNum}`);
						continue;
					}
					throw error;
				}
			} else {
				// Load existing schedule
				schedules.push(finalCheck);
			}
		}
		
		if (schedulesCreated > 0 && schedulesCreated % 50 === 0) {
			console.log(`  Created ${schedulesCreated} schedules...`);
		}
	}
	console.log(`Created ${schedulesCreated} new schedules, total: ${schedules.length} schedules`);

	// ============================================================
	// 9. FLIGHT INSTANCES & FLIGHT SEATS
	// ============================================================
	console.log('\nSeeding Flight Instances and Seats...');
	
	let instanceCount = 0;
	// Generate instances for entire December 2025 (1st to 31st)
	const startDate = new Date(2025, 11, 1, 0, 0, 0, 0); // December 1, 2025
	const endDate = new Date(2025, 11, 31, 23, 59, 59, 999); // December 31, 2025
	
	console.log(`  Generating flight instances from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

	// Process more schedules to create many flight instances for December 2025
	// Process up to 200 schedules to ensure plenty of flights (one way and round trip)
	const schedulesToProcess = schedules.slice(0, Math.min(200, schedules.length));
	console.log(`  Processing ${schedulesToProcess.length} schedules for December 2025...`);

	for (const schedule of schedulesToProcess) {
		// Create a new date object for each schedule to avoid mutation issues
		const currentDate = new Date(startDate.getTime());
		
		while (currentDate <= endDate) {
			// Use getDay() instead of getUTCDay() to use local timezone
			// getDay() returns 0=Sunday, 1=Monday, ..., 6=Saturday
			// operating_days format: '0101010' where index 0=Sunday, 1=Monday, ..., 6=Saturday
			const dayOfWeek = currentDate.getDay();
			const operatingDays = schedule.operating_days;
			
			// Validate operating_days format
			if (!operatingDays || operatingDays.length !== 7) {
				currentDate.setDate(currentDate.getDate() + 1);
				continue;
			}
			
			const bits = operatingDays.split('').map(c => (c === '1' ? 1 : 0));
			
			// Check if schedule operates on this day of week
			// bits[0] = Sunday, bits[1] = Monday, ..., bits[6] = Saturday
			if (bits[dayOfWeek] === 1) {
				// Check if instance already exists
				const existing = await repos.instance
					.createQueryBuilder('fi')
					.where('fi.flight_number = :flightNum', { flightNum: schedule.flight_number })
					.andWhere('CAST(fi.flight_date AS DATE) = CAST(:date AS DATE)', { date: currentDate.toISOString().slice(0, 10) })
					.getOne();

				if (!existing) {
					// Get available aircraft
					const availableAircraft = aircrafts.filter(a => a.in_service);
					if (availableAircraft.length === 0) {
						currentDate.setDate(currentDate.getDate() + 1);
						continue;
					}

					const aircraft = randomElement(availableAircraft);
					const [depHour, depMin] = schedule.departure_time_local.split(':').map(Number);
					const [arrHour, arrMin] = schedule.arrival_time_local.split(':').map(Number);
					
					const departure = new Date(currentDate);
					departure.setHours(depHour, depMin, 0, 0);
					
					const arrival = new Date(currentDate);
					arrival.setHours(arrHour, arrMin, 0, 0);
					if (arrival < departure) {
						arrival.setDate(arrival.getDate() + 1); // Next day arrival
					}

					const instance = await repos.instance.save(repos.instance.create({
						flight_instance_id: uuidv7(), // Generate UUID v7 (time-ordered) manually
						flight_schedule: schedule,
						flight_date: currentDate,
						flight_number: schedule.flight_number,
						aircraft,
						departure_datetime_local: departure,
						arrival_datetime_local: arrival,
						status: randomElement(['scheduled', 'on_time', 'delayed']),
					}));

					// Create flight seats for this instance
					const seatConfigs = await repos.seatConfig
						.createQueryBuilder('sc')
						.innerJoinAndSelect('sc.cabin_class', 'cabin')
						.where('sc.aircraft_type_id = :aircraftTypeId', { aircraftTypeId: aircraft.aircraft_type.aircraft_type_id })
						.getMany();

					// Batch insert seats (reduced batch size to avoid SQL Server 2100 parameter limit)
					// TypeORM save() with array can generate many parameters, so use very small batches
					// Each flight seat has 4 fields, but TypeORM may generate more parameters for relations
					// Using batch size 5 = ~20 parameters per batch (very safe, well below 2100 limit)
					const batchSizeSeats = 5;
					const entitiesToSave: FlightSeat[] = [];
					
					for (const seatConfig of seatConfigs) {
						entitiesToSave.push(repos.seat.create({
							flight_seat_id: uuidv7(),
							flight_instance: instance, // Use relation object - TypeORM will extract flight_instance_id
							seat_config: seatConfig, // Use relation object - TypeORM will extract seat_config_id
							seat_number: seatConfig.seat_number,
							is_available: Math.random() > 0.3, // 70% available
						}));
						
						// Save in batches to avoid parameter limit
						if (entitiesToSave.length >= batchSizeSeats) {
							await repos.seat.save(entitiesToSave);
							entitiesToSave.length = 0; // Clear array
						}
					}
					
					// Save remaining entities
					if (entitiesToSave.length > 0) {
						await repos.seat.save(entitiesToSave);
					}

					instanceCount++;
					if (instanceCount % 100 === 0) {
						console.log(`  Created ${instanceCount} flight instances...`);
					}
				}
			}
			currentDate.setDate(currentDate.getDate() + 1);
		}
	}
	console.log(`Created ${instanceCount} flight instances with seats`);

	// ============================================================
	// 10. RESERVATIONS (Sample reservations)
	// ============================================================
	console.log('\nSeeding Reservations...');
	
	// Get all available flight instances first (needed for reservations)
	const allInstancesForReservations = await repos.instance
		.createQueryBuilder('fi')
		.leftJoinAndSelect('fi.aircraft', 'aircraft')
		.leftJoinAndSelect('aircraft.aircraft_type', 'aircraft_type')
		.orderBy('fi.flight_date', 'ASC')
		.take(500)
		.getMany();
	
	let reservationCount = 0;
	const reservationStatuses = ['pending', 'expired', 'converted', 'cancelled'];
	
	// Get flight instances for reservations
	const reservationInstances = allInstancesForReservations;
	
	for (let i = 0; i < Math.min(200, users.length); i++) {
		const user = users[i];
		
		// Create 1-2 reservations per user
		const numReservations = randomInt(1, 2);
		
		for (let j = 0; j < numReservations; j++) {
			const status = randomElement(reservationStatuses);
			const now = new Date();
			const expiresAt = new Date(now);
			expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes TTL
			
			// Generate unique reservation code
			let reservationCode = generatePNR();
			let attempts = 0;
			while (await repos.reservation.findOne({ where: { reservation_code: reservationCode } }) && attempts < 10) {
				reservationCode = generatePNR();
				attempts++;
			}
			
			// Select random flight instance for segments
			const instance = randomElement(reservationInstances);
			if (!instance) continue;
			
			// Create segments JSON
			const segments = [{
				flightInstanceId: instance.flight_instance_id,
				flightNumber: instance.flight_number,
				departureDatetime: instance.departure_datetime_local,
				arrivalDatetime: instance.arrival_datetime_local,
				segmentType: 'outbound',
				fareClassCode: randomElement(['Y', 'YS', 'YSM']),
				baseFare: randomInt(1000000, 5000000),
				taxAmount: randomInt(100000, 500000),
				feeAmount: randomInt(50000, 250000),
			}];
			
			// 30% chance of round-trip (2 segments)
			if (Math.random() > 0.7) {
				const returnInstance = randomElement(reservationInstances.filter(inst => 
					inst.flight_instance_id !== instance.flight_instance_id &&
					inst.flight_date > instance.flight_date
				));
				if (returnInstance) {
					segments.push({
						flightInstanceId: returnInstance.flight_instance_id,
						flightNumber: returnInstance.flight_number,
						departureDatetime: returnInstance.departure_datetime_local,
						arrivalDatetime: returnInstance.arrival_datetime_local,
						segmentType: 'inbound',
						fareClassCode: randomElement(['Y', 'YS', 'YSM']),
						baseFare: randomInt(1000000, 5000000),
						taxAmount: randomInt(100000, 500000),
						feeAmount: randomInt(50000, 250000),
					});
				}
			}
			
			const totalAmount = segments.reduce((sum, seg) => sum + seg.baseFare + seg.taxAmount + seg.feeAmount, 0);
			const numberOfPassengers = randomInt(1, 4);
			
			// Set status-specific dates
			let convertedAt: Date | null = null;
			if (status === 'expired') {
				expiresAt.setMinutes(expiresAt.getMinutes() - 20); // Expired 20 minutes ago
			} else if (status === 'converted') {
				const converted = new Date(now);
				converted.setMinutes(converted.getMinutes() - 5); // Converted 5 minutes ago
				convertedAt = converted;
			}
			
			await repos.reservation.save(repos.reservation.create({
				reservation_id: uuidv7(),
				reservation_code: reservationCode,
				user,
				segments_json: JSON.stringify(segments),
				number_of_passengers: numberOfPassengers,
				total_amount: totalAmount,
				currency: vnd,
				status,
				expires_at: expiresAt,
				converted_at: convertedAt,
			}));
			
			reservationCount++;
		}
	}
	console.log(`Created ${reservationCount} reservations`);

	// ============================================================
	// 11. BOOKINGS, BOOKING PASSENGERS, SEGMENTS, TICKETS, PAYMENTS
	// ============================================================
	console.log('\nSeeding Bookings and related data...');
	
	// Get all available flight instances (limit to 500 to avoid SQL Server 2100 parameter limit)
	// Reduced from 10000 to prevent query with too many parameters in IN clause
	const allInstances = await repos.instance
		.createQueryBuilder('fi')
		.leftJoinAndSelect('fi.aircraft', 'aircraft')
		.leftJoinAndSelect('aircraft.aircraft_type', 'aircraft_type')
		.orderBy('fi.flight_date', 'ASC')
		.take(500)
		.getMany();
	
	console.log(`  Found ${allInstances.length} flight instances for bookings`);
	
	let bookingCount = 0;
	
	if (allInstances.length === 0) {
		console.log('  No flight instances available. Skipping bookings...');
	} else {
		const maxBookings = Math.min(1000, Math.floor(allInstances.length * 0.5)); // 50% of instances or max 1000
		console.log(`  Creating up to ${maxBookings} bookings...`);
		
		for (let i = 0; i < maxBookings; i++) {
			const user = randomElement(users);
			const pnr = generatePNR();
			
			// Check PNR uniqueness
			const existingPNR = await repos.booking.findOne({ where: { pnr_code: pnr } });
			if (existingPNR) continue;

			// Use realistic contact info (matching user or random)
			const useUserContact = Math.random() > 0.3; // 70% use user's info
			const contactName = useUserContact ? user.fullname : generateVietnameseName();
			const contactEmail = useUserContact ? user.email : generateEmail(contactName);
			const contactPhone = useUserContact ? user.phone : generatePhone();
			const totalAmount = randomInt(1000000, 15000000);
			
			// Booking status: pending -> paid (if payment success), or cancelled
			// Match với business logic: 'pending' (chưa thanh toán), 'paid' (đã thanh toán), 'cancelled'
			const status = randomElement(['pending', 'paid', 'cancelled']);

			const bookingData: any = {
				booking_id: uuidv7(),
				pnr_code: pnr,
				user: user,
				currency: vnd,
				total_amount: totalAmount,
				status,
				channel: randomElement(['web', 'mobile', 'agent', 'call_center']),
				contact_fullname: contactName,
				contact_email: contactEmail,
				contact_phone: contactPhone,
			};
			const newBooking = repos.booking.create(bookingData);
			const savedBooking = await repos.booking.save(newBooking);

			// Get passengers for this user
			const passengers = await repos.passenger
				.createQueryBuilder('p')
				.where('p.user_id = :userId', { userId: user.user_id })
				.getMany();
			if (passengers.length === 0) continue;

			const numPassengers = randomInt(1, Math.min(4, passengers.length));
			const selectedPassengers = passengers.slice(0, numPassengers);

			// Create booking passengers
			const bookingPassengers: BookingPassenger[] = [];
			for (const passenger of selectedPassengers) {
			const newBookingPassenger = repos.bookingPassenger.create({
				booking_passenger_id: uuidv7(),
				booking: savedBooking as any,
				passenger,
				passenger_type: randomElement(['ADT', 'CHD', 'INF']), // ADT = Adult, CHD = Child, INF = Infant
			} as any);
			const bp = (await repos.bookingPassenger.save(newBookingPassenger)) as unknown as BookingPassenger;
			bookingPassengers.push(bp);
		}

		// Create booking segments (1-2 segments per booking)
		const numSegments = randomInt(1, 2);
		const selectedInstances: FlightInstance[] = [];
		for (let j = 0; j < numSegments; j++) {
			const instance = randomElement(allInstances);
			if (!selectedInstances.find(inst => inst.flight_instance_id === instance.flight_instance_id)) {
				selectedInstances.push(instance);
			}
		}

		for (const instance of selectedInstances) {
			// Get available seats for this instance
			const availableSeats = await repos.seat
				.createQueryBuilder('seat')
				.where('seat.flight_instance_id = :instanceId', { instanceId: instance.flight_instance_id })
				.andWhere('seat.is_available = :available', { available: true })
				.take(numPassengers)
				.getMany();

			if (availableSeats.length < numPassengers) continue; // Skip if not enough seats

			// Get fare classes
			const fareClasses = await repos.fareClass.find({
				relations: ['cabin_class'],
			});

			for (let j = 0; j < numPassengers; j++) {
				const bookingPassengerItem = bookingPassengers[j];
				const flightSeat = availableSeats[j];
				const fareClass = randomElement(fareClasses);

				// Get seat config to determine base fare
				const seatConfig = await repos.seatConfig
					.createQueryBuilder('sc')
					.innerJoinAndSelect('sc.cabin_class', 'cabin')
					.where('sc.seat_config_id = :seatConfigId', { seatConfigId: flightSeat.seat_config_id })
					.getOne();

				const baseFare = randomInt(1000000, 5000000);
				const taxAmount = Math.floor(baseFare * 0.1);
				const feeAmount = Math.floor(baseFare * 0.05);

				const newSegment = repos.bookingSegment.create({
					booking_segment_id: uuidv7(),
					booking: savedBooking as any,
					booking_passenger: bookingPassengerItem,
					flight_instance: instance,
					flight_seat: flightSeat,
					fare_class: fareClass,
					base_fare: baseFare,
					tax_amount: taxAmount,
					fee_amount: feeAmount,
					status: status === 'cancelled' ? 'cancelled' : 'booked', // 'booked' là status default cho segment
				} as any);
				const segment = await repos.bookingSegment.save(newSegment);

				// Mark seat as unavailable
				flightSeat.is_available = false;
				await repos.seat.save(flightSeat);

				// Create ticket if booking is paid (tickets issued after payment)
				if (status === 'paid') {
					const ticketNumber = generateTicketNumber();
					const existingTicket = await repos.ticket.findOne({ where: { ticket_number: ticketNumber } });
					if (!existingTicket) {
						const issuedAt = new Date();
						issuedAt.setMinutes(issuedAt.getMinutes() - randomInt(1, 60)); // Issued 1-60 minutes ago
						const newTicket: any = repos.ticket.create({
							ticket_id: uuidv7(),
							booking: savedBooking as any,
							booking_passenger: bookingPassengerItem,
							ticket_number: ticketNumber,
							status: 'issued',
						} as any);
						newTicket.issued_at = issuedAt;
						await repos.ticket.save(newTicket);
					}
				}
			}
		}

		// Create payment (match với booking status)
		if (status !== 'cancelled') {
			const paymentMethodCodes = ['CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'CASH'];
			const paymentMethod = await repos.paymentMethod.findOne({
				where: { payment_method_code: randomElement(paymentMethodCodes) },
			});

			if (paymentMethod) {
				// Payment status: 'pending' (chưa thanh toán) -> 'success' (đã thanh toán), hoặc 'failed'
				const paymentStatus = status === 'paid' ? 'success' : 'pending'; // Match với booking status
				const now = new Date();
				const expiresAt = new Date(now);
				expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiration
				
				// Paid at time (if success, set to 1-60 minutes ago)
				let paidAt: Date | null = null;
				if (paymentStatus === 'success') {
					paidAt = new Date(now);
					paidAt.setMinutes(paidAt.getMinutes() - randomInt(1, 60)); // Paid 1-60 minutes ago
				}
				
				const paymentData: any = {
					payment_id: uuidv7(),
					booking: savedBooking as any,
					amount: totalAmount,
					currency: vnd,
					payment_method: paymentMethod,
					status: paymentStatus,
				};
				
				if (paidAt) {
					paymentData.paid_at = paidAt;
				}
				
				if (paymentStatus === 'success') {
					paymentData.transaction_ref = `TXN${randomInt(100000000, 999999999)}`;
				}
				
				if (paymentStatus === 'pending') {
					paymentData.idempotency_key = `IDEMP-${uuidv7()}`;
					paymentData.expires_at = expiresAt;
				}
				
				await repos.payment.save(repos.payment.create(paymentData));
			}
		}

			bookingCount++;
			if (bookingCount % 100 === 0) {
				console.log(`  Created ${bookingCount} bookings...`);
			}
		}
		console.log(`Created ${bookingCount} bookings with related data`);
	}

	console.log('\nFull database seed completed successfully!');
	console.log('\nSummary:');
	console.log(`  - Airports: ${savedAirports.length}`);
	console.log(`  - Routes: ${routes.length}`);
	console.log(`  - Aircraft Types: ${savedAircraftTypes.length}`);
	console.log(`  - Aircrafts: ${aircrafts.length}`);
	console.log(`  - Flight Schedules: ${schedules.length}`);
	console.log(`  - Flight Instances: ${instanceCount}`);
	console.log(`  - Users: ${users.length}`);
	console.log(`  - Reservations: ${reservationCount}`);
	console.log(`  - Bookings: ${bookingCount}`);
	
	await ds.destroy();
}

run().catch((e) => {
	console.error('Seed failed:', e);
	process.exit(1);
});

