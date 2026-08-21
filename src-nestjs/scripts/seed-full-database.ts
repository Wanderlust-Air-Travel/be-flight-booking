/* eslint-disable no-console */
import 'reflect-metadata';
import { resolve } from 'node:path';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';

// Load .env file from project root
config({ path: resolve(process.cwd(), '.env') });

import { AircraftType } from 'src/api-gateway/data-access/entities/aircraft/aircraft-type.entity';
import { Aircraft } from 'src/api-gateway/data-access/entities/aircraft/aircraft.entity';
import { Airline } from 'src/api-gateway/data-access/entities/airline/airline.entity';
import { Airport } from 'src/api-gateway/data-access/entities/airport/airport.entity';
import { BookingPassenger } from 'src/api-gateway/data-access/entities/booking/booking-passenger.entity';
import { BookingSegmentService } from 'src/api-gateway/data-access/entities/booking/booking-segment-service.entity';
import { BookingSegment } from 'src/api-gateway/data-access/entities/booking/booking-segment.entity';
import { Booking } from 'src/api-gateway/data-access/entities/booking/booking.entity';
import { CabinClass } from 'src/api-gateway/data-access/entities/cabin/cabin-class.entity';
import { CabinService } from 'src/api-gateway/data-access/entities/cabin/cabin-service.entity';
import { Currency } from 'src/api-gateway/data-access/entities/currency/currency.entity';
import { BaggageAllowance } from 'src/api-gateway/data-access/entities/fare/baggage-allowance.entity';
import { FareClass } from 'src/api-gateway/data-access/entities/fare/fare-class.entity';
import { FareDescriptionRule } from 'src/api-gateway/data-access/entities/fare/fare-description-rule.entity';
import { RouteFarePrice } from 'src/api-gateway/data-access/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/api-gateway/data-access/entities/flight/flight-instance.entity';
import { FlightSchedule } from 'src/api-gateway/data-access/entities/flight/flight-schedule.entity';
import { FlightSeat } from 'src/api-gateway/data-access/entities/flight/flight-seat.entity';
import { Passenger } from 'src/api-gateway/data-access/entities/passenger/passenger.entity';
import { PaymentMethod } from 'src/api-gateway/data-access/entities/payment/payment-method.entity';
import { Payment } from 'src/api-gateway/data-access/entities/payment/payment.entity';
import { Reservation } from 'src/api-gateway/data-access/entities/reservation/reservation.entity';
import { Role } from 'src/api-gateway/data-access/entities/role/role.entity';
import { Route } from 'src/api-gateway/data-access/entities/route/route.entity';
import { SeatConfiguration } from 'src/api-gateway/data-access/entities/seat/seat-configuration.entity';
import { Ticket } from 'src/api-gateway/data-access/entities/ticket/ticket.entity';
import { UserRole } from 'src/api-gateway/data-access/entities/user/user-role.entity';
import { User } from 'src/api-gateway/data-access/entities/user/user.entity';
import { SystemRole } from 'src/shared/constants/roles';
import {
    SEAT_COLUMNS,
    SEAT_DISTRIBUTION,
    generateSeatNumber,
    getSeatType,
} from 'src/shared/constants/seat.constants';
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
        Airport,
        Airline,
        Route,
        FlightSchedule,
        FlightInstance,
        FlightSeat,
        AircraftType,
        Aircraft,
        CabinClass,
        FareClass,
        SeatConfiguration,
        User,
        Passenger,
        Role,
        UserRole,
        Currency,
        PaymentMethod,
        Reservation,
        Booking,
        BookingPassenger,
        BookingSegment,
        BookingSegmentService,
        Ticket,
        Payment,
        RouteFarePrice,
        BaggageAllowance,
        CabinService,
        FareDescriptionRule,
    ],
    synchronize: false,
});

/**
 * Check if database already has reference seed data (currencies, fare classes, etc.)
 * Returns true if reference data exists, false otherwise.
 * Flight data (airports, routes, instances) comes from provider sync - not from this seed.
 */
async function hasExistingSeedData(ds: DataSource): Promise<boolean> {
    const currencyRepo = ds.getRepository(Currency);
    const fareClassRepo = ds.getRepository(FareClass);

    const currencyCount = await currencyRepo.count();
    const fareClassCount = await fareClassRepo.count();

    if (currencyCount > 0 || fareClassCount > 0) {
        console.log('\nDatabase đã có dữ liệu reference (currency, fare class, ...):');
        console.log(`   - Currencies: ${currencyCount}`);
        console.log(`   - Fare Classes: ${fareClassCount}`);
        console.log(
            '   Chuyến bay: npm run seed:internal-schedule (VN) hoặc npm run sync:flight-data (Amadeus).'
        );
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
        console.error(
            '   1. Xóa dữ liệu seed hiện có (chạy SQL script: sql/utils/data-management/clear-all-seed-data.sql)'
        );
        console.error('   2. Hoặc xóa và tạo lại database');
        console.error('\n   Script sẽ dừng để tránh duplicate data.');
        await ds.destroy();
        process.exit(1);
    }

    console.log('Database trống, có thể tiếp tục seed...\n');

    const repos = {
        airport: ds.getRepository(Airport),
        airline: ds.getRepository(Airline),
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
        fareDescriptionRule: ds.getRepository(FareDescriptionRule),
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
            const existing = await repos.currency.findOne({
                where: { currency_code: c.currency_code },
            });
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
        vnd = await repos.currency.save(
            repos.currency.create({ currency_code: 'VND', name: 'Vietnamese Dong' })
        );
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
        const existing = await repos.paymentMethod.findOne({
            where: { payment_method_code: pm.payment_method_code },
        });
        if (!existing) {
            await repos.paymentMethod.save(repos.paymentMethod.create(pm));
            console.log(`  Created payment method: ${pm.payment_method_code}`);
        }
    }

    // ============================================================
    // 1.5. AIRLINES
    // ============================================================
    console.log('\nSeeding Airlines...');

    const airlines = [
        {
            iata_code: 'VN',
            icao_code: 'HVN',
            name: 'Vietnam Airlines',
            callsign: 'VIETNAM AIR',
            country: 'Vietnam',
        },
        {
            iata_code: 'VJ',
            icao_code: 'VJC',
            name: 'VietJet Air',
            callsign: 'VIETJET',
            country: 'Vietnam',
        },
        {
            iata_code: 'BL',
            icao_code: 'AV',
            name: 'Bamboo Airways',
            callsign: 'BAMBOO',
            country: 'Vietnam',
        },
        {
            iata_code: 'AA',
            icao_code: 'AAL',
            name: 'American Airlines',
            callsign: 'AMERICAN',
            country: 'United States',
        },
        {
            iata_code: 'BA',
            icao_code: 'BAW',
            name: 'British Airways',
            callsign: 'SPEEDBIRD',
            country: 'United Kingdom',
        },
        {
            iata_code: 'AF',
            icao_code: 'AFR',
            name: 'Air France',
            callsign: 'AIRFRANS',
            country: 'France',
        },
        {
            iata_code: 'LH',
            icao_code: 'DLH',
            name: 'Lufthansa',
            callsign: 'LUFTHANSA',
            country: 'Germany',
        },
        {
            iata_code: 'EK',
            icao_code: 'UAE',
            name: 'Emirates',
            callsign: 'EMIRATES',
            country: 'UAE',
        },
        {
            iata_code: 'SQ',
            icao_code: 'SIA',
            name: 'Singapore Airlines',
            callsign: 'SINGAPORE',
            country: 'Singapore',
        },
        {
            iata_code: 'NH',
            icao_code: 'ANA',
            name: 'All Nippon Airways',
            callsign: 'ALL NIPPON',
            country: 'Japan',
        },
        {
            iata_code: 'QF',
            icao_code: 'QFA',
            name: 'Qantas',
            callsign: 'QANTAS',
            country: 'Australia',
        },
        {
            iata_code: 'KE',
            icao_code: 'KOR',
            name: 'Korean Air',
            callsign: 'KOREAN AIR',
            country: 'South Korea',
        },
    ];

    for (const airline of airlines) {
        const existing = await repos.airline.findOne({
            where: { iata_code: airline.iata_code },
        });
        if (!existing) {
            await repos.airline.save(
                repos.airline.create({
                    airline_id: uuidv7(),
                    ...airline,
                })
            );
            console.log(`  Created airline: ${airline.iata_code} - ${airline.name}`);
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
        const existing = await repos.cabinClass.findOne({
            where: { cabin_class_code: cc.cabin_class_code },
        });
        if (!existing) await repos.cabinClass.save(repos.cabinClass.create(cc));
    }
    const economyCabin = await repos.cabinClass.findOneByOrFail({ cabin_class_code: 'Y' });
    const businessCabin = await repos.cabinClass.findOneByOrFail({ cabin_class_code: 'J' });

    const fareClasses = [
        // Economy fare classes
        {
            fare_class_code: 'YSM',
            cabin_class: economyCabin,
            description: 'Economy Saver Max',
            change_rule: 'Change before departure: 600,000 VND',
            refund_rule: 'Non-refundable',
        },
        {
            fare_class_code: 'YSMX',
            cabin_class: economyCabin,
            description: 'Economy Saver Max Extended',
            change_rule: 'Change before departure: 600,000 VND',
            refund_rule: 'Non-refundable',
        },
        {
            fare_class_code: 'YS',
            cabin_class: economyCabin,
            description: 'Economy Smart',
            change_rule: 'Change before departure: 450,000 VND',
            refund_rule: 'Refund before departure: 450,000 VND',
        },
        {
            fare_class_code: 'YF',
            cabin_class: economyCabin,
            description: 'Economy Flex',
            change_rule: 'Free changes',
            refund_rule: 'Refund before departure: 300,000 VND',
        },
        {
            fare_class_code: 'YFLX',
            cabin_class: economyCabin,
            description: 'Economy Flex Extended',
            change_rule: 'Free changes',
            refund_rule: 'Refund before departure: 300,000 VND',
        },
        {
            fare_class_code: 'Y',
            cabin_class: economyCabin,
            description: 'Economy Standard',
            change_rule: 'Change before departure: 500,000 VND',
            refund_rule: 'Refund before departure: 400,000 VND',
        },
        // Business fare classes
        {
            fare_class_code: 'JS',
            cabin_class: businessCabin,
            description: 'Business Smart',
            change_rule: 'Change before departure: 300,000 VND',
            refund_rule: 'Refund before departure: 450,000 VND',
        },
        {
            fare_class_code: 'JF',
            cabin_class: businessCabin,
            description: 'Business Flex',
            change_rule: 'Free changes',
            refund_rule: 'Refund before departure: 300,000 VND',
        },
        {
            fare_class_code: 'JFLX',
            cabin_class: businessCabin,
            description: 'Business Flex Extended',
            change_rule: 'Free changes',
            refund_rule: 'Refund before departure: 300,000 VND',
        },
        {
            fare_class_code: 'J',
            cabin_class: businessCabin,
            description: 'Business Standard',
            change_rule: 'Change before departure: 350,000 VND',
            refund_rule: 'Refund before departure: 400,000 VND',
        },
    ];
    for (const fc of fareClasses) {
        const existing = await repos.fareClass.findOne({
            where: { fare_class_code: fc.fare_class_code },
        });
        if (!existing) await repos.fareClass.save(repos.fareClass.create(fc));
    }

    // ============================================================
    // 2.5. BAGGAGE ALLOWANCES
    // ============================================================
    console.log('\nSeeding Baggage Allowances...');

    const baggageAllowances = [
        // Economy fare classes
        {
            fare_class_code: 'YSM',
            checked_baggage_kg: null,
            checked_baggage_pieces: null,
            carry_on_kg: 7,
            carry_on_pieces: 1,
            carry_on_dimensions: '55x40x20',
            is_domestic: true,
            is_international: true,
            notes: 'No checked baggage included',
        },
        {
            fare_class_code: 'YSMX',
            checked_baggage_kg: null,
            checked_baggage_pieces: null,
            carry_on_kg: 7,
            carry_on_pieces: 1,
            carry_on_dimensions: '55x40x20',
            is_domestic: true,
            is_international: true,
            notes: 'No checked baggage included',
        },
        {
            fare_class_code: 'Y',
            checked_baggage_kg: 20,
            checked_baggage_pieces: 1,
            carry_on_kg: 7,
            carry_on_pieces: 1,
            carry_on_dimensions: '55x40x20',
            is_domestic: true,
            is_international: true,
            notes: '1 piece 20kg checked baggage',
        },
        {
            fare_class_code: 'YS',
            checked_baggage_kg: 20,
            checked_baggage_pieces: 1,
            carry_on_kg: 7,
            carry_on_pieces: 1,
            carry_on_dimensions: '55x40x20',
            is_domestic: true,
            is_international: true,
            notes: '1 piece 20kg checked baggage',
        },
        {
            fare_class_code: 'YF',
            checked_baggage_kg: 30,
            checked_baggage_pieces: 2,
            carry_on_kg: 7,
            carry_on_pieces: 1,
            carry_on_dimensions: '55x40x20',
            is_domestic: true,
            is_international: true,
            notes: '2 pieces 30kg checked baggage',
        },
        {
            fare_class_code: 'YFLX',
            checked_baggage_kg: 30,
            checked_baggage_pieces: 2,
            carry_on_kg: 7,
            carry_on_pieces: 1,
            carry_on_dimensions: '55x40x20',
            is_domestic: true,
            is_international: true,
            notes: '2 pieces 30kg checked baggage',
        },
        // Business fare classes
        {
            fare_class_code: 'J',
            checked_baggage_kg: 30,
            checked_baggage_pieces: 2,
            carry_on_kg: 7,
            carry_on_pieces: 1,
            carry_on_dimensions: '55x40x20',
            is_domestic: true,
            is_international: true,
            notes: '2 pieces 30kg checked baggage',
        },
        {
            fare_class_code: 'JS',
            checked_baggage_kg: 30,
            checked_baggage_pieces: 2,
            carry_on_kg: 7,
            carry_on_pieces: 1,
            carry_on_dimensions: '55x40x20',
            is_domestic: true,
            is_international: true,
            notes: '2 pieces 30kg checked baggage',
        },
        {
            fare_class_code: 'JF',
            checked_baggage_kg: 40,
            checked_baggage_pieces: 2,
            carry_on_kg: 7,
            carry_on_pieces: 1,
            carry_on_dimensions: '55x40x20',
            is_domestic: true,
            is_international: true,
            notes: '2 pieces 40kg checked baggage',
        },
        {
            fare_class_code: 'JFLX',
            checked_baggage_kg: 40,
            checked_baggage_pieces: 2,
            carry_on_kg: 7,
            carry_on_pieces: 1,
            carry_on_dimensions: '55x40x20',
            is_domestic: true,
            is_international: true,
            notes: '2 pieces 40kg checked baggage',
        },
    ];

    for (const ba of baggageAllowances) {
        const existing = await repos.baggageAllowance.findOne({
            where: {
                fare_class_code: ba.fare_class_code,
                is_domestic: ba.is_domestic,
                is_international: ba.is_international,
            },
        });
        if (!existing) {
            await repos.baggageAllowance.save(
                repos.baggageAllowance.create({
                    baggage_allowance_id: uuidv7(),
                    ...ba,
                })
            );
        }
    }
    console.log(`Seeded ${baggageAllowances.length} baggage allowances`);

    // ============================================================
    // 2.6. CABIN SERVICES
    // ============================================================
    console.log('\nSeeding Cabin Services...');

    const cabinServices = [
        // Economy cabin services (applies to all economy fare classes)
        {
            cabin_class_code: 'Y',
            fare_class_code: null,
            service_type: 'meal',
            service_name: 'Snack',
            description: 'Light snack and beverage',
            is_included: true,
            price: null,
            display_order: 1,
        },
        {
            cabin_class_code: 'Y',
            fare_class_code: null,
            service_type: 'entertainment',
            service_name: 'In-flight Entertainment',
            description: 'Personal screen with movies and music',
            is_included: true,
            price: null,
            display_order: 2,
        },
        {
            cabin_class_code: 'Y',
            fare_class_code: null,
            service_type: 'wifi',
            service_name: 'WiFi Access',
            description: 'Available for purchase',
            is_included: false,
            price: 200000,
            display_order: 3,
        },
        {
            cabin_class_code: 'Y',
            fare_class_code: null,
            service_type: 'seat_selection',
            service_name: 'Seat Selection',
            description: 'Available for purchase',
            is_included: false,
            price: 150000,
            display_order: 4,
        },

        // Economy Flex specific services
        {
            cabin_class_code: 'Y',
            fare_class_code: 'YF',
            service_type: 'meal',
            service_name: 'Hot Meal',
            description: 'Hot meal and beverage',
            is_included: true,
            price: null,
            display_order: 1,
        },
        {
            cabin_class_code: 'Y',
            fare_class_code: 'YFLX',
            service_type: 'meal',
            service_name: 'Hot Meal',
            description: 'Hot meal and beverage',
            is_included: true,
            price: null,
            display_order: 1,
        },
        {
            cabin_class_code: 'Y',
            fare_class_code: 'YF',
            service_type: 'priority_boarding',
            service_name: 'Priority Boarding',
            description: 'Board before general boarding',
            is_included: true,
            price: null,
            display_order: 5,
        },
        {
            cabin_class_code: 'Y',
            fare_class_code: 'YFLX',
            service_type: 'priority_boarding',
            service_name: 'Priority Boarding',
            description: 'Board before general boarding',
            is_included: true,
            price: null,
            display_order: 5,
        },

        // Business cabin services (applies to all business fare classes)
        {
            cabin_class_code: 'J',
            fare_class_code: null,
            service_type: 'meal',
            service_name: 'Gourmet Meal',
            description: 'Multi-course gourmet meal with premium beverages',
            is_included: true,
            price: null,
            display_order: 1,
        },
        {
            cabin_class_code: 'J',
            fare_class_code: null,
            service_type: 'entertainment',
            service_name: 'Premium Entertainment',
            description: 'Large screen with premium content',
            is_included: true,
            price: null,
            display_order: 2,
        },
        {
            cabin_class_code: 'J',
            fare_class_code: null,
            service_type: 'wifi',
            service_name: 'WiFi Access',
            description: 'Complimentary WiFi',
            is_included: true,
            price: null,
            display_order: 3,
        },
        {
            cabin_class_code: 'J',
            fare_class_code: null,
            service_type: 'seat_selection',
            service_name: 'Seat Selection',
            description: 'Complimentary seat selection',
            is_included: true,
            price: null,
            display_order: 4,
        },
        {
            cabin_class_code: 'J',
            fare_class_code: null,
            service_type: 'priority_boarding',
            service_name: 'Priority Boarding',
            description: 'Priority boarding access',
            is_included: true,
            price: null,
            display_order: 5,
        },
        {
            cabin_class_code: 'J',
            fare_class_code: null,
            service_type: 'lounge_access',
            service_name: 'Lounge Access',
            description: 'Access to business class lounge',
            is_included: true,
            price: null,
            display_order: 6,
        },
        {
            cabin_class_code: 'J',
            fare_class_code: null,
            service_type: 'extra_legroom',
            service_name: 'Extra Legroom',
            description: 'More legroom and space',
            is_included: true,
            price: null,
            display_order: 7,
        },

        // Business Flex specific services
        {
            cabin_class_code: 'J',
            fare_class_code: 'JF',
            service_type: 'meal',
            service_name: 'Premium Gourmet Meal',
            description: 'Chef-curated premium meal with fine wines',
            is_included: true,
            price: null,
            display_order: 1,
        },
        {
            cabin_class_code: 'J',
            fare_class_code: 'JFLX',
            service_type: 'meal',
            service_name: 'Premium Gourmet Meal',
            description: 'Chef-curated premium meal with fine wines',
            is_included: true,
            price: null,
            display_order: 1,
        },
        {
            cabin_class_code: 'J',
            fare_class_code: 'JF',
            service_type: 'lounge_access',
            service_name: 'Premium Lounge Access',
            description: 'Access to premium lounge with spa services',
            is_included: true,
            price: null,
            display_order: 6,
        },
        {
            cabin_class_code: 'J',
            fare_class_code: 'JFLX',
            service_type: 'lounge_access',
            service_name: 'Premium Lounge Access',
            description: 'Access to premium lounge with spa services',
            is_included: true,
            price: null,
            display_order: 6,
        },
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
            await repos.cabinService.save(
                repos.cabinService.create({
                    cabin_service_id: uuidv7(),
                    ...cs,
                })
            );
        }
    }
    console.log(`Seeded ${cabinServices.length} cabin services`);

    // ============================================================
    // 2.7. FARE DESCRIPTION RULES
    // ============================================================
    console.log('\nSeeding Fare Description Rules...');

    // Check if rules already exist
    const existingRulesCount = await repos.fareDescriptionRule.count();
    if (existingRulesCount > 0) {
        console.log(
            `  Found ${existingRulesCount} existing fare description rules. Skipping seed.`
        );
    } else {
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
        for (const rule of rules) {
            await repos.fareDescriptionRule.save(
                repos.fareDescriptionRule.create({
                    id: uuidv7(),
                    ...rule,
                })
            );
        }

        console.log(`  Successfully inserted ${rules.length} fare description rules`);
    }

    // ============================================================
    // 3. AIRCRAFT TYPES & AIRCRAFTS
    // ============================================================
    console.log('\nSeeding Aircraft Types and Aircraft...');

    const aircraftTypes = [
        { code: '320', manufacturer: 'Airbus', model: 'A320-200', total_seats: 180 },
        { code: '321', manufacturer: 'Airbus', model: 'A321-200', total_seats: 220 },
        { code: '319', manufacturer: 'Airbus', model: 'A319-100', total_seats: 140 },
        { code: '332', manufacturer: 'Airbus', model: 'A330-200', total_seats: 293 },
        { code: '359', manufacturer: 'Airbus', model: 'A350-900', total_seats: 325 },
        { code: '789', manufacturer: 'Boeing', model: '787-9 Dreamliner', total_seats: 280 },
        { code: '77W', manufacturer: 'Boeing', model: '777-300ER', total_seats: 396 },
        { code: '738', manufacturer: 'Boeing', model: '737-800', total_seats: 162 },
    ];

    const seededAircraftTypes: AircraftType[] = [];
    for (const at of aircraftTypes) {
        let aircraftType = await repos.aircraftType.findOne({ where: { code: at.code } });
        if (!aircraftType) {
            aircraftType = await repos.aircraftType.save(
                repos.aircraftType.create({
                    aircraft_type_id: uuidv7(),
                    ...at,
                })
            );
            console.log(`  Created aircraft type: ${at.code} - ${at.model}`);
        }
        seededAircraftTypes.push(aircraftType);
    }

    // Create a default aircraft for each aircraft type
    for (const aircraftType of seededAircraftTypes) {
        const regNum = seededAircraftTypes.indexOf(aircraftType) + 1;
        const existingAircraft = await repos.aircraft.findOne({
            where: { registration: `VN-${aircraftType.code}-${String(regNum).padStart(3, '0')}` },
        });
        if (!existingAircraft) {
            await repos.aircraft.save(
                repos.aircraft.create({
                    aircraft_id: uuidv7(),
                    aircraft_type: aircraftType,
                    registration: `VN-${aircraftType.code}-${String(regNum).padStart(3, '0')}`,
                    in_service: true,
                })
            );
            console.log(
                `  Created aircraft: VN-${aircraftType.code}-${String(regNum).padStart(3, '0')}`
            );
        }
    }

    const defaultAircraftType = await repos.aircraftType.findOne({ where: { code: '320' } });
    if (!defaultAircraftType) {
        throw new Error(
            'Seed failed: AircraftType with code "320" not found. Run seat types seeding first.'
        );
    }
    const defaultAircraft = await repos.aircraft.findOne({ where: { registration: 'VN-320-001' } });

    // ============================================================
    // 4. SEAT CONFIGURATIONS (for default aircraft type)
    // ============================================================
    const existingSeatConfig = await repos.seatConfig.count({
        where: { aircraft_type: { aircraft_type_id: defaultAircraftType.aircraft_type_id } },
    });
    if (existingSeatConfig === 0) {
        const totalSeats = defaultAircraftType.total_seats;
        const businessSeats = Math.floor(totalSeats * SEAT_DISTRIBUTION.BUSINESS_PERCENTAGE);
        const seatConfigs: Partial<SeatConfiguration>[] = [];
        for (
            let row = 1;
            row <= Math.ceil(businessSeats / SEAT_DISTRIBUTION.COLUMNS_PER_ROW);
            row++
        ) {
            for (const col of SEAT_COLUMNS) {
                if (seatConfigs.length >= businessSeats) break;
                seatConfigs.push({
                    aircraft_type: defaultAircraftType,
                    seat_number: generateSeatNumber(row, col),
                    cabin_class: businessCabin,
                    seat_type: getSeatType(col),
                    is_exit_row: false,
                });
            }
        }
        let row = Math.ceil(businessSeats / SEAT_DISTRIBUTION.COLUMNS_PER_ROW) + 1;
        while (seatConfigs.length < totalSeats) {
            for (const col of SEAT_COLUMNS) {
                if (seatConfigs.length >= totalSeats) break;
                seatConfigs.push({
                    aircraft_type: defaultAircraftType,
                    seat_number: generateSeatNumber(row, col),
                    cabin_class: economyCabin,
                    seat_type: getSeatType(col),
                    is_exit_row: row % 10 === 0,
                });
            }
            row++;
        }
        const batchSize = 50;
        for (let i = 0; i < seatConfigs.length; i += batchSize) {
            const batch = seatConfigs.slice(i, i + batchSize);
            await repos.seatConfig.save(
                batch.map((sc) => repos.seatConfig.create({ ...sc, seat_config_id: uuidv7() }))
            );
        }
        console.log(`  Created ${seatConfigs.length} seat configurations for A320`);
    }

    // ============================================================
    // 5. TEST USERS (1 user per role; password shared for dev only)
    // ============================================================
    console.log('\nSeeding test users (one per role)...');
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // Mapping: roleCode -> { email, fullname, phone, roleName }
    const testUserMappings: Array<{ role: SystemRole; fullname: string; phone: string }> = [
        { role: SystemRole.CUSTOMER, fullname: 'Test Customer', phone: '0900000010' },
        { role: SystemRole.TRAVEL_AGENT, fullname: 'Test Travel Agent', phone: '0900000011' },
        {
            role: SystemRole.SCHEDULE_PLANNER,
            fullname: 'Test Schedule Planner',
            phone: '0900000012',
        },
        { role: SystemRole.REVENUE_ANALYST, fullname: 'Test Revenue Analyst', phone: '0900000013' },
        {
            role: SystemRole.ANCILLARY_MANAGER,
            fullname: 'Test Ancillary Manager',
            phone: '0900000014',
        },
        { role: SystemRole.CALL_CENTER, fullname: 'Test Call Center', phone: '0900000015' },
        { role: SystemRole.ADMIN, fullname: 'System Administrator', phone: '0900000001' },
        {
            role: SystemRole.ACCOUNTING_STAFF,
            fullname: 'Test Accounting Staff',
            phone: '0900000016',
        },
        {
            role: SystemRole.DISTRIBUTION_MANAGER,
            fullname: 'Test Distribution Manager',
            phone: '0900000017',
        },
        { role: SystemRole.FRAUD_ANALYST, fullname: 'Test Fraud Analyst', phone: '0900000018' },
    ];

    const createdTestUserEmails: string[] = [];

    for (const mapping of testUserMappings) {
        const email = `${mapping.role.toLowerCase()}@flightbooking.com`;
        let user = await repos.user.findOne({ where: { email } });
        if (!user) {
            user = await repos.user.save(
                repos.user.create({
                    user_id: uuidv7(),
                    fullname: mapping.fullname,
                    email,
                    password_hash: passwordHash,
                    phone: mapping.phone,
                    is_active: true,
                })
            );
            console.log(`  Created user: ${email} (password: Password123!)`);
        }
        createdTestUserEmails.push(email);

        // Assign the role
        const role = await repos.role.findOne({ where: { role_code: mapping.role } });
        if (role) {
            const hasRole = await repos.userRole.findOne({
                where: { user_id: user.user_id, role_code: mapping.role },
            });
            if (!hasRole) {
                await repos.userRole.save(
                    repos.userRole.create({ user_id: user.user_id, role_code: mapping.role })
                );
                console.log(`  Assigned role ${mapping.role} to ${email}`);
            }
        }
    }

    // Assign CUSTOMER role to admin (backward compatibility with original seed)
    const adminEmail = 'admin@flightbooking.com';
    const adminUser = await repos.user.findOne({ where: { email: adminEmail } });
    if (adminUser) {
        const customerRole = await repos.role.findOne({
            where: { role_code: SystemRole.CUSTOMER },
        });
        if (customerRole) {
            const hasCustomer = await repos.userRole.findOne({
                where: { user_id: adminUser.user_id, role_code: SystemRole.CUSTOMER },
            });
            if (!hasCustomer) {
                await repos.userRole.save(
                    repos.userRole.create({
                        user_id: adminUser.user_id,
                        role_code: SystemRole.CUSTOMER,
                    })
                );
                console.log('  Assigned role CUSTOMER to admin@flightbooking.com');
            }
        }
    }

    console.log('\n--- Reference seed hoàn tất ---');
    console.log(
        'Hãng bay riêng (recommended): npm run seed:internal-schedule  → sân bay VN + lịch nội bộ.'
    );
    console.log(
        'Demo từ Amadeus (optional):   npm run sync:flight-data       → cần AMADEUS_CLIENT_ID/SECRET.'
    );

    await ds.destroy();
}
run().catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
});
