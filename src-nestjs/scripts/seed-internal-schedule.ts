/**
 * Seed lịch bay nội bộ – mô hình hãng bay riêng (Vietnam nội địa).
 * Tạo sân bay VN, routes, flight schedules/instances/seat/giá trong DB (không dùng Amadeus).
 * Chạy sau seed reference: npm run seed:full, rồi: npm run seed:internal-schedule
 */
/* eslint-disable no-console */
import 'reflect-metadata';
import { resolve } from 'node:path';
import { config } from 'dotenv';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { v7 as uuidv7 } from 'uuid';

config({ path: resolve(process.cwd(), '.env') });

import { AircraftType } from 'src/shared/entities/aircraft/aircraft-type.entity';
import { Aircraft } from 'src/shared/entities/aircraft/aircraft.entity';
import { Airport } from 'src/shared/entities/airport/airport.entity';
import { CabinClass } from 'src/shared/entities/cabin/cabin-class.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { SeatConfiguration } from 'src/shared/entities/seat/seat-configuration.entity';
import { DataSource } from 'typeorm';

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
    extra: { requestTimeout: 120000, connectionTimeout: 60000 },
    entities: [
        Airport,
        Route,
        FlightSchedule,
        FlightInstance,
        FlightSeat,
        AircraftType,
        Aircraft,
        SeatConfiguration,
        RouteFarePrice,
        FareClass,
        CabinClass,
    ],
    synchronize: false,
});

const VIETNAM_AIRPORTS = [
    {
        iata_code: 'HAN',
        icao_code: 'VVNB',
        name: 'Noi Bai International',
        city: 'Hanoi',
        country: 'Vietnam',
        timezone: 'Asia/Ho_Chi_Minh',
    },
    {
        iata_code: 'SGN',
        icao_code: 'VVTS',
        name: 'Tan Son Nhat International',
        city: 'Ho Chi Minh City',
        country: 'Vietnam',
        timezone: 'Asia/Ho_Chi_Minh',
    },
    {
        iata_code: 'DAD',
        icao_code: 'VVDN',
        name: 'Da Nang International',
        city: 'Da Nang',
        country: 'Vietnam',
        timezone: 'Asia/Ho_Chi_Minh',
    },
    {
        iata_code: 'CXR',
        icao_code: 'VVCR',
        name: 'Cam Ranh International',
        city: 'Nha Trang',
        country: 'Vietnam',
        timezone: 'Asia/Ho_Chi_Minh',
    },
    {
        iata_code: 'PQC',
        icao_code: 'VVPQ',
        name: 'Phu Quoc International',
        city: 'Phu Quoc',
        country: 'Vietnam',
        timezone: 'Asia/Ho_Chi_Minh',
    },
    {
        iata_code: 'HUI',
        icao_code: 'VVPH',
        name: 'Phu Bai International',
        city: 'Hue',
        country: 'Vietnam',
        timezone: 'Asia/Ho_Chi_Minh',
    },
    {
        iata_code: 'VCA',
        icao_code: 'VVCT',
        name: 'Can Tho International',
        city: 'Can Tho',
        country: 'Vietnam',
        timezone: 'Asia/Ho_Chi_Minh',
    },
    {
        iata_code: 'HPH',
        icao_code: 'VVCI',
        name: 'Cat Bi International',
        city: 'Hai Phong',
        country: 'Vietnam',
        timezone: 'Asia/Ho_Chi_Minh',
    },
    {
        iata_code: 'DLI',
        icao_code: 'VVDL',
        name: 'Lien Khuong',
        city: 'Da Lat',
        country: 'Vietnam',
        timezone: 'Asia/Ho_Chi_Minh',
    },
];

const ROUTE_PAIRS: Array<[string, string, number]> = [
    ['SGN', 'HAN', 1150],
    ['HAN', 'SGN', 1150],
    ['SGN', 'DAD', 600],
    ['DAD', 'SGN', 600],
    ['HAN', 'DAD', 610],
    ['DAD', 'HAN', 610],
    ['SGN', 'CXR', 400],
    ['CXR', 'SGN', 400],
    ['SGN', 'PQC', 300],
    ['PQC', 'SGN', 300],
    ['HAN', 'HPH', 120],
    ['HPH', 'HAN', 120],
];

const FLIGHT_NUMBER_PREFIX = 'BBO';

async function run() {
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
    const economyFareClass = await fareClassRepo.findOne({ where: { fare_class_code: 'Y' } });
    if (!defaultAircraftType || !defaultAircraft || !economyFareClass) {
        console.error('Chạy npm run seed:full trước (reference data + aircraft + fare class).');
        await ds.destroy();
        process.exit(1);
    }

    const seatConfigs = await seatConfigRepo.find({
        where: { aircraft_type: { aircraft_type_id: defaultAircraftType.aircraft_type_id } },
    });
    if (seatConfigs.length === 0) {
        console.error('Chưa có seat configuration. Chạy npm run seed:full trước.');
        await ds.destroy();
        process.exit(1);
    }

    console.log('--- Seed lịch bay nội bộ (Vietnam nội địa) ---\n');

    const airportByIata = new Map<string, Airport>();
    for (const ap of VIETNAM_AIRPORTS) {
        let airport = await airportRepo.findOne({ where: { iata_code: ap.iata_code } });
        if (!airport) {
            airport = await airportRepo.save(
                airportRepo.create({
                    airport_id: uuidv7(),
                    ...ap,
                })
            );
            console.log(`  Airport: ${ap.iata_code}`);
        }
        airportByIata.set(ap.iata_code, airport);
    }

    const routes: Array<{ route: Route; origin: string; dest: string }> = [];
    for (const [originCode, destCode, distanceKm] of ROUTE_PAIRS) {
        const origin = airportByIata.get(originCode);
        const dest = airportByIata.get(destCode);
        if (!origin || !dest) continue;

        let route = await routeRepo
            .createQueryBuilder('r')
            .where('r.origin_airport_id = :oid', { oid: origin.airport_id })
            .andWhere('r.destination_airport_id = :did', { did: dest.airport_id })
            .getOne();
        if (!route) {
            route = await routeRepo.save(
                routeRepo.create({
                    route_id: uuidv7(),
                    origin_airport: origin,
                    destination_airport: dest,
                    distance_km: distanceKm,
                    is_domestic: true,
                })
            );
            console.log(`  Route: ${originCode} -> ${destCode}`);
        }
        routes.push({ route, origin: originCode, dest: destCode });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const effectiveFrom = new Date(today);
    const effectiveTo = new Date(today);
    effectiveTo.setDate(effectiveTo.getDate() + 365);

    const BATCH_SEATS = 50;
    for (let r = 0; r < routes.length; r++) {
        const { route, origin, dest } = routes[r];
        const flightNumber = `${FLIGHT_NUMBER_PREFIX}${String(r + 1).padStart(3, '0')}`;
        console.log(`  Tuyến ${r + 1}/${routes.length}: ${origin} -> ${dest} (${flightNumber})...`);

        let schedule = await scheduleRepo.findOne({
            where: { flight_number: flightNumber, route: { route_id: route.route_id } },
        });
        if (!schedule) {
            schedule = await scheduleRepo.save(
                scheduleRepo.create({
                    flight_schedule_id: uuidv7(),
                    flight_number: flightNumber,
                    route,
                    aircraft_type: defaultAircraftType,
                    departure_time_local: '06:00:00',
                    arrival_time_local: '07:30:00',
                    operating_days: '1234567',
                    effective_from: effectiveFrom,
                    effective_to: effectiveTo,
                    status: 'active',
                })
            );
        }

        const existingPrice = await routeFarePriceRepo.findOne({
            where: { route_id: route.route_id, fare_class_code: economyFareClass.fare_class_code },
        });
        if (!existingPrice) {
            await routeFarePriceRepo.save(
                routeFarePriceRepo.create({
                    route_fare_price_id: uuidv7(),
                    route_id: route.route_id,
                    fare_class_code: economyFareClass.fare_class_code,
                    base_price: 1500000,
                    tax_rate: 0.1,
                    fee_rate: 0.05,
                    effective_from: effectiveFrom,
                    effective_to: effectiveTo,
                    is_active: true,
                    priority: 0,
                    notes: 'Giá nội bộ hãng',
                })
            );
        }

        for (let d = 1; d <= 30; d++) {
            const flightDate = new Date(today);
            flightDate.setDate(flightDate.getDate() + d);

            const existing = await instanceRepo.findOne({
                where: {
                    flight_schedule: { flight_schedule_id: schedule.flight_schedule_id },
                    flight_date: flightDate,
                },
            });
            if (existing) continue;

            const depDt = new Date(flightDate);
            depDt.setHours(6, 0, 0, 0);
            const arrDt = new Date(flightDate);
            arrDt.setHours(7, 30, 0, 0);

            const instance = await instanceRepo.save(
                instanceRepo.create({
                    flight_instance_id: uuidv7(),
                    flight_schedule: schedule,
                    flight_date: flightDate,
                    flight_number: schedule.flight_number,
                    aircraft: defaultAircraft,
                    departure_datetime_local: depDt,
                    arrival_datetime_local: arrDt,
                    status: 'scheduled',
                })
            );

            const seatEntities = seatConfigs.map((sc) =>
                seatRepo.create({
                    flight_seat_id: uuidv7(),
                    flight_instance: instance,
                    seat_config: sc,
                    seat_number: sc.seat_number,
                    is_available: true,
                })
            );
            for (let i = 0; i < seatEntities.length; i += BATCH_SEATS) {
                const batch = seatEntities.slice(i, i + BATCH_SEATS);
                await seatRepo.save(batch);
            }
        }
    }

    console.log('\n--- Seed lịch nội bộ xong ---');
    console.log(`  Airports: ${airportByIata.size}, Routes: ${routes.length}`);
    console.log(
        '  Flight schedules & instances (30 ngày) + seats + giá đã tạo. Trang web tìm chuyến từ DB.'
    );
    await ds.destroy();
}

run().catch((e) => {
    console.error('Seed internal schedule failed:', e);
    process.exit(1);
});
