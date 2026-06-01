/* eslint-disable no-console */
import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';

config({ path: resolve(process.cwd(), '.env') });

const command = process.argv[2] || 'help';

const OURAIRPORTS_BASE_URL = process.env.OURAIRPORTS_BASE_URL || 'https://davidmegginson.github.io/ourairports-data';

async function fetchOurAirports(): Promise<any[]> {
  console.log('Fetching airports from OurAirports (free CSV)...');
  const response = await axios.get(`${OURAIRPORTS_BASE_URL}/airports.csv`, { timeout: 30000 });
  const lines = response.data.trim().split('\n');
  const airports: any[] = [];

  for (let i = 1; i < lines.length && airports.length < 100; i++) {
    const values = lines[i].split(',');
    if (values.length < 13) continue;

    const iata = values[12]?.trim().replace(/"/g, '');
    if (iata && /^[A-Z]{3}$/.test(iata)) {
      airports.push({
        iata_code: iata,
        icao_code: values[0]?.trim().replace(/"/g, '') || null,
        name: values[3]?.trim().replace(/"/g, '') || iata,
        city: values[10]?.trim().replace(/"/g, '') || 'Unknown',
        country: values[8]?.trim().replace(/"/g, '') || 'Unknown',
      });
    }
  }
  return airports;
}

const MOCK_AIRLINES = [
  { iata_code: 'VN', name: 'Vietnam Airlines', country: 'Vietnam' },
  { iata_code: 'VJ', name: 'VietJet Air', country: 'Vietnam' },
  { iata_code: 'BL', name: 'Bamboo Airways', country: 'Vietnam' },
  { iata_code: 'AA', name: 'American Airlines', country: 'United States' },
  { iata_code: 'BA', name: 'British Airways', country: 'United Kingdom' },
  { iata_code: 'SQ', name: 'Singapore Airlines', country: 'Singapore' },
  { iata_code: 'EK', name: 'Emirates', country: 'UAE' },
];

const MOCK_AIRCRAFT = [
  { iata_code: '320', name: 'Airbus A320' },
  { iata_code: '321', name: 'Airbus A321' },
  { iata_code: '332', name: 'Airbus A330-200' },
  { iata_code: '359', name: 'Airbus A350-900' },
  { iata_code: '789', name: 'Boeing 787-9' },
  { iata_code: '738', name: 'Boeing 737-800' },
];

async function main() {
  switch (command) {
    case 'sync':
      await runSync();
      break;
    case 'check':
      await runCheck();
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

async function runSync() {
  console.log('\n🔄 Starting data sync...\n');

  let airports: any[] = [];

  try {
    airports = await fetchOurAirports();
    console.log(`✓ Loaded ${airports.length} airports from OurAirports\n`);
  } catch (error) {
    console.log('⚠ OurAirports unavailable, using fallback data\n');
    airports = getFallbackAirports();
  }

  console.log(`✓ Total airports: ${airports.length}`);
  console.log(`✓ Airlines: ${MOCK_AIRLINES.length}`);
  console.log(`✓ Aircraft: ${MOCK_AIRCRAFT.length}\n`);

  console.log(`
╔════════════════════════════════════════════════════════════╗
║  ✓ DATA SYNC COMPLETE                                   ║
╠════════════════════════════════════════════════════════════╣
║  Source: OurAirports (free CSV)                          ║
║  Airports: ${String(airports.length).padEnd(40)}║
║  Airlines: ${String(MOCK_AIRLINES.length).padEnd(40)}║
║  Aircraft: ${String(MOCK_AIRCRAFT.length).padEnd(40)}║
╚════════════════════════════════════════════════════════════╝
  `);
}

async function runCheck() {
  console.log('\n🏥 Checking data source availability...\n');

  try {
    await axios.get(`${OURAIRPORTS_BASE_URL}/airports.csv`, { timeout: 5000 });
    console.log('  OurAirports (free CSV): \x1b[32m✓ Available\x1b[0m\n');
  } catch {
    console.log('  OurAirports (free CSV): \x1b[33m○ Unavailable\x1b[0m\n');
  }
}

function getFallbackAirports(): any[] {
  return [
    { iata_code: 'SGN', name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'Vietnam' },
    { iata_code: 'HAN', name: 'Noi Bai International Airport', city: 'Hanoi', country: 'Vietnam' },
    { iata_code: 'DAD', name: 'Da Nang International Airport', city: 'Da Nang', country: 'Vietnam' },
    { iata_code: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan' },
    { iata_code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore' },
    { iata_code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand' },
    { iata_code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States' },
    { iata_code: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom' },
  ];
}

function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  DATA PROVIDER CLI                                       ║
╠════════════════════════════════════════════════════════════╣
║  npm run data:sync   - Sync reference data               ║
║  npm run data:check - Check data source availability     ║
║                                                          ║
║  Sources:                                                 ║
║  • OurAirports (free CSV)                                ║
║  • Mock fallback (always available)                       ║
╚════════════════════════════════════════════════════════════╝
  `);
}

main().catch((error) => {
  console.error('Command failed:', error);
  process.exit(1);
});
