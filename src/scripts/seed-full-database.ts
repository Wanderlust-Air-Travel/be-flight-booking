/* eslint-disable no-console */
import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import * as bcrypt from 'bcrypt';
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
import { SeatConfiguration } from 'src/shared/entities/seat/seat-configuration.entity';
import { User } from 'src/shared/entities/user/user.entity';
import { Passenger } from 'src/shared/entities/passenger/passenger.entity';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { PaymentMethod } from 'src/shared/entities/payment/payment-method.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { BookingPassenger } from 'src/shared/entities/booking/booking-passenger.entity';
import { BookingSegment } from 'src/shared/entities/booking/booking-segment.entity';
import { Ticket } from 'src/shared/entities/ticket/ticket.entity';
import { Payment } from 'src/shared/entities/payment/payment.entity';

const ds = new DataSource({
	type: 'mssql',
	host: process.env.DB_HOST ?? 'localhost',
	port: Number(process.env.DB_PORT ?? 1433),
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
		User, Passenger, Currency, PaymentMethod, Booking, BookingPassenger,
		BookingSegment, Ticket, Payment,
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

async function run() {
	console.log('🚀 Starting full database seed...');
	
	try {
		await ds.initialize();
		console.log('✅ Database connected');
		
		// Test connection with a simple query and set command timeout
		console.log('Testing connection...');
		const queryRunner = ds.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.query('SELECT 1 as test');
		await queryRunner.release();
		console.log('✅ Connection test successful');
	} catch (error) {
		console.error('❌ Database connection failed:', error);
		console.error('Error details:', error);
		throw error;
	}

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
		booking: ds.getRepository(Booking),
		bookingPassenger: ds.getRepository(BookingPassenger),
		bookingSegment: ds.getRepository(BookingSegment),
		ticket: ds.getRepository(Ticket),
		payment: ds.getRepository(Payment),
	};

	// ============================================================
	// 1. CURRENCIES & PAYMENT METHODS
	// ============================================================
	console.log('\n📊 Seeding Currencies and Payment Methods...');
	
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
				console.log(`  ✅ Created currency: ${c.currency_code}`);
			}
		} catch (error) {
			console.error(`  ❌ Error with currency ${c.currency_code}:`, error);
			// Continue with next currency instead of failing completely
		}
	}
	
	let vnd;
	try {
		vnd = await repos.currency.findOneByOrFail({ currency_code: 'VND' });
	} catch (error) {
		console.error('❌ Failed to find VND currency. Creating it now...');
		vnd = await repos.currency.save(repos.currency.create({ currency_code: 'VND', name: 'Vietnamese Dong' }));
	}

	const paymentMethods = [
		{ payment_method_code: 'CARD', name: 'Credit/Debit Card', description: 'Visa, Mastercard, JCB' },
		{ payment_method_code: 'BANK', name: 'Bank Transfer', description: 'Internet Banking' },
		{ payment_method_code: 'MOMO', name: 'MoMo Wallet', description: 'MoMo e-wallet' },
		{ payment_method_code: 'ZALO', name: 'ZaloPay', description: 'ZaloPay e-wallet' },
		{ payment_method_code: 'VNPAY', name: 'VNPay', description: 'VNPay gateway' },
	];
	for (const pm of paymentMethods) {
		const existing = await repos.paymentMethod.findOne({ where: { payment_method_code: pm.payment_method_code } });
		if (!existing) await repos.paymentMethod.save(repos.paymentMethod.create(pm));
	}

	// ============================================================
	// 2. CABIN CLASSES & FARE CLASSES
	// ============================================================
	console.log('\n✈️ Seeding Cabin Classes and Fare Classes...');
	
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
		{ fare_class_code: 'YS', cabin_class: economyCabin, description: 'Economy Smart', change_rule: 'Change before departure: 450,000 VND', refund_rule: 'Refund before departure: 450,000 VND' },
		{ fare_class_code: 'YF', cabin_class: economyCabin, description: 'Economy Flex', change_rule: 'Free changes', refund_rule: 'Refund before departure: 300,000 VND' },
		{ fare_class_code: 'Y', cabin_class: economyCabin, description: 'Economy Standard', change_rule: 'Change before departure: 500,000 VND', refund_rule: 'Refund before departure: 400,000 VND' },
		// Business fare classes
		{ fare_class_code: 'JS', cabin_class: businessCabin, description: 'Business Smart', change_rule: 'Change before departure: 300,000 VND', refund_rule: 'Refund before departure: 450,000 VND' },
		{ fare_class_code: 'JF', cabin_class: businessCabin, description: 'Business Flex', change_rule: 'Free changes', refund_rule: 'Refund before departure: 300,000 VND' },
		{ fare_class_code: 'J', cabin_class: businessCabin, description: 'Business Standard', change_rule: 'Change before departure: 350,000 VND', refund_rule: 'Refund before departure: 400,000 VND' },
	];
	for (const fc of fareClasses) {
		const existing = await repos.fareClass.findOne({ where: { fare_class_code: fc.fare_class_code } });
		if (!existing) await repos.fareClass.save(repos.fareClass.create(fc));
	}

	// ============================================================
	// 3. AIRCRAFT TYPES & AIRCRAFTS
	// ============================================================
	console.log('\n🛫 Seeding Aircraft Types and Aircrafts...');
	
	const aircraftTypes = [
		{ code: 'A320', manufacturer: 'Airbus', model: 'A320-200', total_seats: 180 },
		{ code: 'A321', manufacturer: 'Airbus', model: 'A321-200', total_seats: 220 },
		{ code: 'A350', manufacturer: 'Airbus', model: 'A350-900', total_seats: 325 },
		{ code: 'B737', manufacturer: 'Boeing', model: '737-800', total_seats: 189 },
		{ code: 'B787', manufacturer: 'Boeing', model: '787-9 Dreamliner', total_seats: 290 },
		{ code: 'ATR72', manufacturer: 'ATR', model: 'ATR 72-600', total_seats: 72 },
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
	console.log(`✅ Created ${aircrafts.length} aircrafts`);

	// ============================================================
	// 4. SEAT CONFIGURATIONS (for each aircraft type)
	// ============================================================
	console.log('\n💺 Seeding Seat Configurations...');
	
	for (const aircraftType of savedAircraftTypes) {
		const existing = await repos.seatConfig.count({ where: { aircraft_type: { aircraft_type_id: aircraftType.aircraft_type_id } } });
		if (existing > 0) continue; // Skip if already configured

		const totalSeats = aircraftType.total_seats;
		const businessSeats = Math.floor(totalSeats * 0.1); // 10% business
		const economySeats = totalSeats - businessSeats;

		const seatConfigs: Partial<SeatConfiguration>[] = [];
		
		// Business seats (rows 1-3, typically)
		for (let row = 1; row <= Math.ceil(businessSeats / 6); row++) {
			for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
				if (seatConfigs.length >= businessSeats) break;
				seatConfigs.push({
					aircraft_type: aircraftType,
					seat_number: `${row}${col}`,
					cabin_class: businessCabin,
					seat_type: ['A', 'F'].includes(col) ? 'Window' : ['B', 'E'].includes(col) ? 'Middle' : 'Aisle',
					is_exit_row: false,
				});
			}
		}

		// Economy seats
		let row = Math.ceil(businessSeats / 6) + 1;
		while (seatConfigs.length < totalSeats) {
			for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
				if (seatConfigs.length >= totalSeats) break;
				seatConfigs.push({
					aircraft_type: aircraftType,
					seat_number: `${row}${col}`,
					cabin_class: economyCabin,
					seat_type: ['A', 'F'].includes(col) ? 'Window' : ['B', 'E'].includes(col) ? 'Middle' : 'Aisle',
					is_exit_row: row % 10 === 0, // Every 10th row is exit row
				});
			}
			row++;
		}

		// Batch insert
		const batchSize = 100;
		for (let i = 0; i < seatConfigs.length; i += batchSize) {
			const batch = seatConfigs.slice(i, i + batchSize);
			await repos.seatConfig.save(batch.map(sc => repos.seatConfig.create({
				...sc,
				seat_config_id: uuidv7(),
			})));
		}
		console.log(`✅ Created ${seatConfigs.length} seat configurations for ${aircraftType.code}`);
	}

	// ============================================================
	// 5. AIRPORTS
	// ============================================================
	console.log('\n🌍 Seeding Airports...');
	
	const airportsData = [
		// Vietnam domestic
		{ iata_code: 'HAN', icao_code: 'VVNB', name: 'Noi Bai International', city: 'Hanoi', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'SGN', icao_code: 'VVTS', name: 'Tan Son Nhat International', city: 'Ho Chi Minh City', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'DAD', icao_code: 'VVDN', name: 'Da Nang International', city: 'Da Nang', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'HPH', icao_code: 'VVCI', name: 'Cat Bi International', city: 'Hai Phong', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'VCA', icao_code: 'VVCT', name: 'Can Tho International', city: 'Can Tho', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'PQC', icao_code: 'VVPQ', name: 'Phu Quoc International', city: 'Phu Quoc', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'VCL', icao_code: 'VVCA', name: 'Cam Ranh International', city: 'Nha Trang', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'DLI', icao_code: 'VVDL', name: 'Lien Khuong', city: 'Da Lat', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'UIH', icao_code: 'VVPC', name: 'Phu Cat', city: 'Quy Nhon', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'TBB', icao_code: 'VVTH', name: 'Dong Tac', city: 'Tuy Hoa', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		// International
		{ iata_code: 'BKK', icao_code: 'VTBS', name: 'Suvarnabhumi', city: 'Bangkok', country: 'Thailand', timezone: 'Asia/Bangkok' },
		{ iata_code: 'SIN', icao_code: 'WSSS', name: 'Changi', city: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore' },
		{ iata_code: 'KUL', icao_code: 'WMKK', name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'Malaysia', timezone: 'Asia/Kuala_Lumpur' },
		{ iata_code: 'NRT', icao_code: 'RJAA', name: 'Narita International', city: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo' },
		{ iata_code: 'ICN', icao_code: 'RKSI', name: 'Incheon International', city: 'Seoul', country: 'South Korea', timezone: 'Asia/Seoul' },
		{ iata_code: 'PEK', icao_code: 'ZBAA', name: 'Beijing Capital International', city: 'Beijing', country: 'China', timezone: 'Asia/Shanghai' },
		{ iata_code: 'PVG', icao_code: 'ZSPD', name: 'Shanghai Pudong International', city: 'Shanghai', country: 'China', timezone: 'Asia/Shanghai' },
		{ iata_code: 'HKG', icao_code: 'VHHH', name: 'Hong Kong International', city: 'Hong Kong', country: 'Hong Kong', timezone: 'Asia/Hong_Kong' },
		{ iata_code: 'TPE', icao_code: 'RCTP', name: 'Taiwan Taoyuan International', city: 'Taipei', country: 'Taiwan', timezone: 'Asia/Taipei' },
		{ iata_code: 'SYD', icao_code: 'YSSY', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', timezone: 'Australia/Sydney' },
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
	console.log(`✅ Created ${savedAirports.length} airports`);

	// ============================================================
	// 6. ROUTES
	// ============================================================
	console.log('\n🛣️ Seeding Routes...');
	
	const routes: Route[] = [];
	const distances: Record<string, number> = {
		'HAN-SGN': 1150, 'SGN-HAN': 1150,
		'HAN-DAD': 610, 'DAD-HAN': 610,
		'SGN-DAD': 600, 'DAD-SGN': 600,
		'HAN-HPH': 120, 'HPH-HAN': 120,
		'SGN-VCA': 170, 'VCA-SGN': 170,
		'SGN-PQC': 300, 'PQC-SGN': 300,
		'SGN-VCL': 400, 'VCL-SGN': 400,
		'HAN-BKK': 1000, 'BKK-HAN': 1000,
		'SGN-SIN': 1100, 'SIN-SGN': 1100,
		'HAN-NRT': 3300, 'NRT-HAN': 3300,
		'SGN-ICN': 3200, 'ICN-SGN': 3200,
	};

	// Create routes between all airports (domestic and international)
	let routesCreated = 0;
	for (const origin of savedAirports) {
		for (const dest of savedAirports) {
			if (origin.airport_id === dest.airport_id) continue;
			
			const key = `${origin.iata_code}-${dest.iata_code}`;
			const distance = distances[key] || randomInt(500, 5000);
			const isDomestic = origin.country === 'Vietnam' && dest.country === 'Vietnam';

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
	console.log(`✅ Created ${routesCreated} new routes, total: ${routes.length} routes`);

	// ============================================================
	// 7. USERS & PASSENGERS
	// ============================================================
	console.log('\n👥 Seeding Users and Passengers...');
	
	const passwordHash = await bcrypt.hash('Password123!', 10);
	const users: User[] = [];
	const batchSize = 100;

	for (let i = 0; i < 500; i++) {
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

			// Create 1-3 passengers per user
			const numPassengers = randomInt(1, 3);
			for (let j = 0; j < numPassengers; j++) {
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
			}

			if ((i + 1) % 100 === 0) {
				console.log(`  ✅ Created ${i + 1} users...`);
			}
		}
	}
	console.log(`✅ Created ${users.length} users with passengers`);

	// ============================================================
	// 8. FLIGHT SCHEDULES
	// ============================================================
	console.log('\n📅 Seeding Flight Schedules...');
	
	const now = new Date();
	// Set from date to today at midnight (local timezone)
	// Use local date components to avoid timezone issues
	const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
	const to = new Date(from);
	to.setFullYear(to.getFullYear() + 1); // 1 year ahead
	
	// For flight instances, generate from today to 180 days ahead (instead of 90)
	// This ensures we have data for testing with various dates

	const flightNumbers = ['BBO', 'VNA', 'VJ', 'QH'];
	const operatingDaysPatterns = [
		'1111111', // Daily
		'1010101', // Mon, Wed, Fri, Sun
		'0101010', // Tue, Thu, Sat
		'1111100', // Mon-Fri
		'0000011', // Sat-Sun
	];

	const schedules: FlightSchedule[] = [];
	// Create multiple schedules per route for more variety
	// Focus on domestic routes first (better for testing)
	const domesticRoutes = routes.filter(r => r.is_domestic);
	
	// Prioritize popular routes (HAN-SGN, HAN-DAD, SGN-DAD, etc.) to ensure they have instances
	const popularRouteCodes = ['HAN-SGN', 'SGN-HAN', 'HAN-DAD', 'DAD-HAN', 'SGN-DAD', 'DAD-SGN', 'HAN-HPH', 'HPH-HAN', 'SGN-PQC', 'PQC-SGN'];
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
	const maxRoutes = Math.min(150, routesToUse.length); // Use up to 150 routes for reasonable number of schedules
	
	let schedulesCreated = 0;
	// Track used flight numbers to avoid duplicates within the same period
	const usedFlightNumbers = new Set<string>();
	
	for (const route of routesToUse.slice(0, maxRoutes)) {
		// Create 2-3 schedules per route for reasonable data
		const numSchedules = randomInt(2, 3);
		
		for (let s = 0; s < numSchedules; s++) {
			const aircraftType = randomElement(savedAircraftTypes);
			const operatingDays = randomElement(operatingDaysPatterns);

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
						console.log(`  ⚠️  Skipping duplicate schedule: ${flightNum}`);
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
			console.log(`  ✅ Created ${schedulesCreated} schedules...`);
		}
	}
	console.log(`✅ Created ${schedulesCreated} new schedules, total: ${schedules.length} schedules`);

	// ============================================================
	// 9. FLIGHT INSTANCES & FLIGHT SEATS
	// ============================================================
	console.log('\n✈️ Seeding Flight Instances and Seats...');
	
	let instanceCount = 0;
	const startDate = new Date(from);
	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + 60); // Generate instances for next 60 days (2 months)

	// Process all schedules (or up to 50 for reasonable number of instances and seats)
	const schedulesToProcess = schedules.slice(0, 50);
	console.log(`  Processing ${schedulesToProcess.length} schedules...`);

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

					const flightSeats: Partial<FlightSeat>[] = [];
					for (const seatConfig of seatConfigs) {
						flightSeats.push({
							flight_instance: instance,
							seat_config: seatConfig,
							seat_number: seatConfig.seat_number,
							is_available: Math.random() > 0.3, // 70% available
						});
					}

					// Batch insert seats
					for (let i = 0; i < flightSeats.length; i += batchSize) {
						const batch = flightSeats.slice(i, i + batchSize);
						await repos.seat.save(batch.map(fs => repos.seat.create({
							...fs,
							flight_seat_id: uuidv7(),
						})));
					}

					instanceCount++;
					if (instanceCount % 100 === 0) {
						console.log(`  ✅ Created ${instanceCount} flight instances...`);
					}
				}
			}
			currentDate.setDate(currentDate.getDate() + 1);
		}
	}
	console.log(`✅ Created ${instanceCount} flight instances with seats`);

	// ============================================================
	// 10. BOOKINGS, BOOKING PASSENGERS, SEGMENTS, TICKETS, PAYMENTS
	// ============================================================
	console.log('\n🎫 Seeding Bookings and related data...');
	
	// Get all available flight instances (limit to 10000 for performance)
	const allInstances = await repos.instance
		.createQueryBuilder('fi')
		.leftJoinAndSelect('fi.aircraft', 'aircraft')
		.leftJoinAndSelect('aircraft.aircraft_type', 'aircraft_type')
		.orderBy('fi.flight_date', 'ASC')
		.take(10000)
		.getMany();
	
	console.log(`  Found ${allInstances.length} flight instances for bookings`);
	
	let bookingCount = 0;
	
	if (allInstances.length === 0) {
		console.log('  ⚠️  No flight instances available. Skipping bookings...');
	} else {
		const maxBookings = Math.min(1000, Math.floor(allInstances.length * 0.5)); // 50% of instances or max 1000
		console.log(`  Creating up to ${maxBookings} bookings...`);
		
		for (let i = 0; i < maxBookings; i++) {
		const user = randomElement(users);
		const pnr = generatePNR();
		
		// Check PNR uniqueness
		const existingPNR = await repos.booking.findOne({ where: { pnr_code: pnr } });
		if (existingPNR) continue;

		const contactName = generateVietnameseName();
		const contactEmail = generateEmail(contactName);
		const contactPhone = generatePhone();
		const totalAmount = randomInt(1000000, 15000000);
		const status = randomElement(['confirmed', 'pending', 'cancelled', 'completed']);

		const booking = await repos.booking.save(repos.booking.create({
			booking_id: uuidv7(),
			pnr_code: pnr,
			user,
			currency: vnd,
			total_amount: totalAmount,
			status,
			channel: randomElement(['web', 'mobile', 'agent', 'call_center']),
			contact_fullname: contactName,
			contact_email: contactEmail,
			contact_phone: contactPhone,
		}));

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
			const bp = await repos.bookingPassenger.save(repos.bookingPassenger.create({
				booking_passenger_id: uuidv7(),
				booking,
				passenger,
				passenger_type: randomElement(['ADT', 'CHD', 'INF']), // ADT = Adult, CHD = Child, INF = Infant
			}));
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
				const bookingPassenger = bookingPassengers[j];
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

				const segment = await repos.bookingSegment.save(repos.bookingSegment.create({
					booking_segment_id: uuidv7(),
					booking,
					booking_passenger: bookingPassenger,
					flight_instance: instance,
					flight_seat: flightSeat,
					fare_class: fareClass,
					base_fare: baseFare,
					tax_amount: taxAmount,
					fee_amount: feeAmount,
					status: status === 'cancelled' ? 'cancelled' : 'confirmed',
				}));

				// Mark seat as unavailable
				flightSeat.is_available = false;
				await repos.seat.save(flightSeat);

				// Create ticket if booking is confirmed
				if (status === 'confirmed' || status === 'completed') {
					const ticketNumber = generateTicketNumber();
					const existingTicket = await repos.ticket.findOne({ where: { ticket_number: ticketNumber } });
					if (!existingTicket) {
						await repos.ticket.save(repos.ticket.create({
							ticket_id: uuidv7(),
							booking,
							booking_passenger: bookingPassenger,
							ticket_number: ticketNumber,
							status: 'issued',
						}));
					}
				}
			}
		}

		// Create payment
		if (status !== 'cancelled') {
			const paymentMethod = await repos.paymentMethod.findOne({
				where: { payment_method_code: randomElement(['CARD', 'BANK', 'MOMO', 'ZALO', 'VNPAY']) },
			});

			if (paymentMethod) {
				const paymentStatus = status === 'confirmed' || status === 'completed' ? 'completed' : 'pending';
				await repos.payment.save(repos.payment.create({
					payment_id: uuidv7(),
					booking,
					amount: totalAmount,
					currency: vnd,
					payment_method: paymentMethod,
					status: paymentStatus,
					paid_at: paymentStatus === 'completed' ? new Date() : null,
					transaction_ref: `TXN${randomInt(100000000, 999999999)}`,
				}));
			}
		}

			bookingCount++;
			if (bookingCount % 100 === 0) {
				console.log(`  ✅ Created ${bookingCount} bookings...`);
			}
		}
		console.log(`✅ Created ${bookingCount} bookings with related data`);
	}

	console.log('\n🎉 Full database seed completed successfully!');
	console.log('\n📊 Summary:');
	console.log(`  - Airports: ${savedAirports.length}`);
	console.log(`  - Routes: ${routes.length}`);
	console.log(`  - Aircraft Types: ${savedAircraftTypes.length}`);
	console.log(`  - Aircrafts: ${aircrafts.length}`);
	console.log(`  - Flight Schedules: ${schedules.length}`);
	console.log(`  - Flight Instances: ${instanceCount}`);
	console.log(`  - Users: ${users.length}`);
	console.log(`  - Bookings: ${bookingCount}`);
	
	await ds.destroy();
}

run().catch((e) => {
	console.error('❌ Seed failed:', e);
	process.exit(1);
});

