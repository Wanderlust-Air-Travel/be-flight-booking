/* eslint-disable no-console */
import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file from project root (works with ts-node)
config({ path: resolve(process.cwd(), '.env') });

import { DataSource } from 'typeorm';
import { Airport } from 'src/shared/entities/airport/airport.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { AircraftType } from 'src/shared/entities/aircraft/aircraft-type.entity';

const ds = new DataSource({
	type: 'mssql',
	host: process.env.DB_HOST ?? 'localhost',
	port: Number(process.env.DB_PORT ?? 1433),
	username: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME,
	options: {
		encrypt: process.env.DB_ENCRYPT === 'true',
		trustServerCertificate: process.env.DB_TRUE_CERT === 'true',
	},
	entities: [Airport, Route, FlightSchedule, AircraftType],
	synchronize: false,
});

async function run() {
	await ds.initialize();
	const airportRepo = ds.getRepository(Airport);
	const routeRepo = ds.getRepository(Route);
	const scheduleRepo = ds.getRepository(FlightSchedule);
	const aircraftTypeRepo = ds.getRepository(AircraftType);

	// Minimal set of domestic airports
	const airports: Array<Partial<Airport>> = [
		{ iata_code: 'HAN', icao_code: 'VVNB', name: 'Noi Bai International', city: 'Hanoi', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'SGN', icao_code: 'VVTS', name: 'Tan Son Nhat International', city: 'Ho Chi Minh City', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
		{ iata_code: 'DAD', icao_code: 'VVDN', name: 'Da Nang International', city: 'Da Nang', country: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh' },
	];

	for (const a of airports) {
		const existing = await airportRepo.findOne({ where: { iata_code: a.iata_code! } });
		if (!existing) await airportRepo.save(airportRepo.create(a));
	}

	const han = await airportRepo.findOneByOrFail({ iata_code: 'HAN' });
	const sgn = await airportRepo.findOneByOrFail({ iata_code: 'SGN' });
	const dad = await airportRepo.findOneByOrFail({ iata_code: 'DAD' });

	// Ensure at least one aircraft type exists
	let a320: AircraftType | null = await aircraftTypeRepo.findOne({ where: { code: 'A320' } });
	if (!a320) {
		a320 = await aircraftTypeRepo.save(aircraftTypeRepo.create({
			code: 'A320',
			manufacturer: 'Airbus',
			model: 'A320',
			total_seats: 180,
		}));
	}

	// Routes (domestic) - Dùng relation objects để TypeORM tự map sang foreign key columns
	const routes: Array<Partial<Route>> = [
		{ origin_airport: han, destination_airport: sgn, distance_km: 1150, is_domestic: true },
		{ origin_airport: sgn, destination_airport: han, distance_km: 1150, is_domestic: true },
		{ origin_airport: han, destination_airport: dad, distance_km: 610, is_domestic: true },
		{ origin_airport: dad, destination_airport: han, distance_km: 610, is_domestic: true },
	];
	for (const r of routes) {
		// Check existence bằng QueryBuilder (dùng column names từ DB)
		const exists = await routeRepo
			.createQueryBuilder('route')
			.where('route.origin_airport_id = :origin', { origin: r.origin_airport!.airport_id })
			.andWhere('route.destination_airport_id = :dest', { dest: r.destination_airport!.airport_id })
			.getOne();
		if (!exists) {
			// Save dùng relation objects - TypeORM sẽ tự map sang foreign key columns
			await routeRepo.save(routeRepo.create(r));
		}
	}

	// Schedules (daily)
	const now = new Date();
	const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const to = new Date(from);
	to.setMonth(to.getMonth() + 6);
	const operating = '1111111';
	const routeHanSgn = await routeRepo
		.createQueryBuilder('route')
		.where('route.origin_airport_id = :origin', { origin: han.airport_id })
		.andWhere('route.destination_airport_id = :dest', { dest: sgn.airport_id })
		.getOneOrFail();
	const routeSgnHan = await routeRepo
		.createQueryBuilder('route')
		.where('route.origin_airport_id = :origin', { origin: sgn.airport_id })
		.andWhere('route.destination_airport_id = :dest', { dest: han.airport_id })
		.getOneOrFail();

	const schedules: Array<Partial<FlightSchedule>> = [
		{ flight_number: 'BBO100', route: routeHanSgn, aircraft_type: a320, departure_time_local: '08:00', arrival_time_local: '10:10', operating_days: operating, effective_from: from, effective_to: to, status: 'active' },
		{ flight_number: 'BBO101', route: routeSgnHan, aircraft_type: a320, departure_time_local: '18:00', arrival_time_local: '20:10', operating_days: operating, effective_from: from, effective_to: to, status: 'active' },
	];
	for (const s of schedules) {
		const exists = await scheduleRepo.findOne({ where: { flight_number: s.flight_number!, effective_from: s.effective_from!, effective_to: s.effective_to! } as any });
		if (!exists) await scheduleRepo.save(scheduleRepo.create(s));
	}

	console.log('Seed completed for domestic airports, routes, and schedules.');
	await ds.destroy();
}

run().catch((e) => {
	console.error(e);
	process.exit(1);
});


