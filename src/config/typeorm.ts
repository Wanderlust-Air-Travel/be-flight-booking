import { DataSource } from "typeorm";
import { Passenger } from "src/shared/entities/passenger/passenger.entity";
import { User } from "src/shared/entities/user/user.entity";

export default new DataSource({
    type: 'mssql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 1433),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    options: { encrypt: process.env.DB_ENCRYPT === 'true'},
    extra: { trustServerCertificate: process.env.DB_TRUST_CERT === 'true'},
    entities: [User, Passenger],
    migrations: ['/dist/migration/*.js'],
    synchronize: false,
})