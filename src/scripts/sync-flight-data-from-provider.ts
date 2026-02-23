/**
 * Sync flight data (airports, routes, flight instances, prices) from Amadeus for Developers.
 * Chạy sau khi đã seed reference data: npm run sync:flight-data
 * Cần AMADEUS_CLIENT_ID và AMADEUS_CLIENT_SECRET trong .env (đăng ký miễn phí tại developers.amadeus.com)
 */
/* eslint-disable no-console */
import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { v7 as uuidv7 } from 'uuid';
import axios from 'axios';

config({ path: resolve(process.cwd(), '.env') });

import { DataSource } from 'typeorm';
import { Airport } from 'src/shared/entities/airport/airport.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { AircraftType } from 'src/shared/entities/aircraft/aircraft-type.entity';
import { Aircraft } from 'src/shared/entities/aircraft/aircraft.entity';
import { SeatConfiguration } from 'src/shared/entities/seat/seat-configuration.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { CabinClass } from 'src/shared/entities/cabin/cabin-class.entity';

const ds = new DataSource({
	type: 'mssql',
	host: process.env.DB_HOST!,
	port: Number(process.env.DB_PORT!),
	username: process.env.DB_USER!,
	password: process.env.DB_PASS!,
	database: process.env.DB_NAME!,
	options: {
		encrypt: process.env.DB_ENCRYPT === 'true',
		trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
		enableArithAbort: true,
	},
	extra: { requestTimeout: 60000, connectionTimeout: 30000 },
	entities: [
		Airport, Route, FlightSchedule, FlightInstance, FlightSeat,
		AircraftType, Aircraft, SeatConfiguration, RouteFarePrice, FareClass, CabinClass,
	],
	synchronize: false,
});

const AMADEUS_TOKEN_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
const AMADEUS_FLIGHT_OFFERS_URL = 'https://test.api.amadeus.com/v2/shopping/flight-offers';

interface AmadeusTokenResponse {
	access_token: string;
	expires_in: number;
}

interface AmadeusFlightOffer {
	type: string;
	id: string;
	itineraries: Array<{
		segments: Array<{
			departure: { iataCode: string; at: string };
			arrival: { iataCode: string; at: string };
			carrierCode: string;
			number: string;
			aircraft?: { code?: string };
		}>;
		duration?: string;
	}>;
	price: { total: string; currency: string };
}

async function getAmadeusToken(): Promise<string> {
	const clientId = process.env.AMADEUS_CLIENT_ID;
	const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error('Thiếu AMADEUS_CLIENT_ID hoặc AMADEUS_CLIENT_SECRET trong .env. Đăng ký miễn phí tại https://developers.amadeus.com');
	}
	const params = new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: clientId,
		client_secret: clientSecret,
	});
	const { data } = await axios.post<AmadeusTokenResponse>(AMADEUS_TOKEN_URL, params.toString(), {
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		timeout: 10000,
	});
	return data.access_token;
}

async function fetchFlightOffers(token: string, origin: string, dest: string, date: string): Promise<AmadeusFlightOffer[]> {
	const { data } = await axios.get<{ data?: AmadeusFlightOffer[] }>(AMADEUS_FLIGHT_OFFERS_URL, {
		params: {
			originLocationCode: origin,
			destinationLocationCode: dest,
			departureDate: date,
			adults: 1,
			max: 10,
		},
		headers: { Authorization: `Bearer ${token}` },
		timeout: 15000,
	});
	return data.data ?? [];
}

async function ensureAirport(
	airportRepo: ReturnType<DataSource['getRepository']>,
	iataCode: string,
	name?: string,
): Promise<Airport> {
	const code = iataCode.toUpperCase();
	const existing = await airportRepo.findOne({ where: { iata_code: code } });
	if (existing) return existing as Airport;
	const created = await airportRepo.save(airportRepo.create({
		airport_id: uuidv7(),
		iata_code: code,
		icao_code: null,
		name: name ?? code,
		city: 'Unknown',
		country: 'Unknown',
		timezone: 'UTC',
	}));
	console.log(`  Airport: ${code} (${name ?? code})`);
	return created as Airport;
}

function parseLocalTime(iso: string): { date: Date; timeStr: string } {
	const d = new Date(iso);
	const h = String(d.getUTCHours()).padStart(2, '0');
	const min = String(d.getUTCMinutes()).padStart(2, '0');
	const sec = String(d.getUTCSeconds()).padStart(2, '0');
	return {
		date: new Date(iso.slice(0, 10)),
		timeStr: `${h}:${min}:${sec}`,
	};
}

async function run() {
	const clientId = process.env.AMADEUS_CLIENT_ID;
	const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		console.error('Thiếu AMADEUS_CLIENT_ID hoặc AMADEUS_CLIENT_SECRET trong .env');
		console.log('Đăng ký miễn phí: https://developers.amadeus.com → Create account → My Self-Service APIs → Create new app');
		process.exit(1);
	}

	await ds.initialize();
	const airportRepo = ds.getRepository(Airport);
	const routeRepo = ds.getRepository(Route);
	const scheduleRepo = ds.getRepository(FlightSchedule);
	const instanceRepo = ds.getRepository(FlightInstance);
	const seatRepo = ds.getRepository(FlightSeat);
	const aircraftTypeRepo = ds.getRepository(AircraftType);
	const aircraftRepo = ds.getRepository(Aircraft);
	const seatConfigRepo = ds.getRepository(SeatConfiguration);
	const routeFarePriceRepo = ds.getRepository(RouteFarePrice);
	const fareClassRepo = ds.getRepository(FareClass);

	const defaultAircraftType = await aircraftTypeRepo.findOne({ where: { code: 'A320' } });
	const defaultAircraft = await aircraftRepo.findOne({ where: { registration: 'VN-A320-001' } });
	if (!defaultAircraftType || !defaultAircraft) {
		console.error('Chạy seed reference trước: npm run seed:full');
		await ds.destroy();
		process.exit(1);
	}

	const seatConfigs = await seatConfigRepo.find({
		where: { aircraft_type: { aircraft_type_id: defaultAircraftType.aircraft_type_id } },
		relations: ['cabin_class'],
	});
	if (seatConfigs.length === 0) {
		console.error('Chưa có seat configuration cho A320. Chạy npm run seed:full trước.');
		await ds.destroy();
		process.exit(1);
	}

	const economyFareClass = await fareClassRepo.findOne({ where: { fare_class_code: 'Y' } });
	if (!economyFareClass) {
		console.error('Chưa có fare class Y. Chạy npm run seed:full trước.');
		await ds.destroy();
		process.exit(1);
	}

	console.log('Lấy token Amadeus...');
	const token = await getAmadeusToken();

	const today = new Date();
	const dates: string[] = [];
	for (let i = 1; i <= 7; i++) {
		const d = new Date(today);
		d.setDate(d.getDate() + i);
		dates.push(d.toISOString().slice(0, 10));
	}

	const routePairs: Array<[string, string]> = [
		['MAD', 'BCN'],
		['PAR', 'MAD'],
		['LON', 'PAR'],
		['BCN', 'MAD'],
	];

	let offersProcessed = 0;
	let routesCreated = 0;
	let instancesCreated = 0;

	for (const [originCode, destCode] of routePairs) {
		for (const date of dates.slice(0, 2)) {
			try {
				const offers = await fetchFlightOffers(token, originCode, destCode, date);
				for (const offer of offers) {
					const itinerary = offer.itineraries?.[0];
					if (!itinerary?.segments?.length) continue;
					if (itinerary.segments.length > 1) continue;

					const seg = itinerary.segments[0];
					const dep = seg.departure;
					const arr = seg.arrival;
					const originAirport = await ensureAirport(airportRepo, dep.iataCode);
					const destAirport = await ensureAirport(airportRepo, arr.iataCode);

					let route = await routeRepo
						.createQueryBuilder('r')
						.where('r.origin_airport_id = :oid', { oid: originAirport.airport_id })
						.andWhere('r.destination_airport_id = :did', { did: destAirport.airport_id })
						.getOne();
					if (!route) {
						route = await routeRepo.save(routeRepo.create({
							route_id: uuidv7(),
							origin_airport: originAirport,
							destination_airport: destAirport,
							distance_km: null,
							is_domestic: true,
						}));
						routesCreated++;
					}

					const depParsed = parseLocalTime(dep.at);
					const arrParsed = parseLocalTime(arr.at);
					const flightNumber = `${seg.carrierCode}${seg.number}`;

					let schedule = await scheduleRepo.findOne({
						where: {
							flight_number: flightNumber,
							route_id: route.route_id,
						},
					});
					if (!schedule) {
						schedule = await scheduleRepo.save(scheduleRepo.create({
							flight_schedule_id: uuidv7(),
							flight_number: flightNumber,
							route,
							aircraft_type: defaultAircraftType,
							departure_time_local: depParsed.timeStr,
							arrival_time_local: arrParsed.timeStr,
							operating_days: '1234567',
							effective_from: depParsed.date,
							effective_to: new Date(depParsed.date.getTime() + 365 * 24 * 60 * 60 * 1000),
							status: 'active',
						}));
					}

					const depDateTime = new Date(dep.at);
					const arrDateTime = new Date(arr.at);

					const existingInstance = await instanceRepo.findOne({
						where: {
							flight_schedule_id: schedule.flight_schedule_id,
							flight_date: depParsed.date,
						},
					});
					if (existingInstance) continue;

					const instance = await instanceRepo.save(instanceRepo.create({
						flight_instance_id: uuidv7(),
						flight_schedule: schedule,
						flight_date: depParsed.date,
						flight_number: flightNumber,
						aircraft: defaultAircraft,
						departure_datetime_local: depDateTime,
						arrival_datetime_local: arrDateTime,
						status: 'scheduled',
					}));
					instancesCreated++;

					for (const sc of seatConfigs) {
						await seatRepo.save(seatRepo.create({
							flight_seat_id: uuidv7(),
							flight_instance: instance,
							seat_config: sc,
							seat_number: sc.seat_number,
							is_available: true,
						}));
					}

					const totalPrice = parseFloat(offer.price.total);
					const priceVnd = offer.price.currency === 'EUR' ? Math.round(totalPrice * 27000) : offer.price.currency === 'USD' ? Math.round(totalPrice * 25000) : Math.round(totalPrice);
					await routeFarePriceRepo.save(routeFarePriceRepo.create({
						route_fare_price_id: uuidv7(),
						route_id: route.route_id,
						fare_class_code: economyFareClass.fare_class_code,
						base_price: priceVnd,
						tax_rate: 0.1,
						fee_rate: 0.05,
						effective_from: depParsed.date,
						effective_to: new Date(depParsed.date.getTime() + 30 * 24 * 60 * 60 * 1000),
						is_active: true,
						priority: 0,
						notes: `From Amadeus ${offer.price.currency} ${offer.price.total}`,
					}));

					offersProcessed++;
					if (offersProcessed % 5 === 0) console.log(`  Đã xử lý ${offersProcessed} offers...`);
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				console.warn(`  Skip ${originCode}-${destCode} ${date}: ${msg}`);
			}
		}
	}

	console.log(`\nSync xong: ${offersProcessed} offers → instances: ${instancesCreated}, routes: ${routesCreated}`);
	await ds.destroy();
}

run().catch((e) => {
	console.error('Sync failed:', e);
	process.exit(1);
});
