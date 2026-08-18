const sql = require('mssql');

(async () => {
  const cfg = {
    server: 'localhost', port: 1434, user: 'sa', password: 'StrongPass1234',
    options: { encrypt: true, trustServerCertificate: true },
  };
  await sql.connect(cfg);
  await sql.query("IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'flight_booking_db') CREATE DATABASE flight_booking_db");
  console.log('Database ready');
  const r = await sql.query('SELECT name FROM sys.databases');
  console.log('Databases:', r.recordset.map(d => d.name).join(', '));
  await sql.close();
})();
