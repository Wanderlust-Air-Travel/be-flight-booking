const mssql = require('mssql');
const config = {
  server: process.env.DB_HOST || 'sqlserver',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || 'flight_booking_db',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASS || 'Passw0rd123!',
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  },
  pool: { max: 1 }
};
console.log('Config:', JSON.stringify({
  server: config.server,
  port: config.port,
  database: config.database,
  user: config.user,
  password: config.password ? '[SET]' : '[EMPTY]',
  encrypt: config.options.encrypt,
  trustServerCertificate: config.options.trustServerCertificate
}));
mssql.connect(config).then(() => {
  console.log('CONNECTED');
  process.exit(0);
}).catch(e => {
  console.error('ERROR:', e.message);
  console.error('Code:', e.code);
  process.exit(1);
});
