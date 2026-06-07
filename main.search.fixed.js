"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = require("node:path");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)({ path: (0, node_path_1.resolve)(process.cwd(), '.env') });
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const microservices_1 = require("@nestjs/microservices");
const typeorm_1 = require("@nestjs/typeorm");
const search_messages_1 = require("./search.messages");
const search_module_1 = require("./search.module");
const incoming_request_deserializer_1 = require("./deserializers/incoming-request.deserializer");







let SearchBootstrapModule = class SearchBootstrapModule {
};
SearchBootstrapModule = __decorate([
    (0, common_2.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mssql',
                host: process.env.DB_HOST,
                port: Number(process.env.DB_PORT),
                username: process.env.DB_USER,
                password: process.env.DB_PASS,
                database: process.env.DB_NAME,
                options: {
                    encrypt: process.env.DB_ENCRYPT === 'true',
                    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
                },
                synchronize: false,
                entities: [`${__dirname}/../../shared/entities/**/*.entity.{ts,js}`],
            }),
            search_module_1.SearchModule,
        ],
    })
], SearchBootstrapModule);
async function bootstrap() {
    const app = await core_1.NestFactory.createMicroservice(SearchBootstrapModule, {
        transport: microservices_1.Transport.TCP,
        options: {
            host: search_messages_1.SEARCH_MS.TCP_HOST,
            port: search_messages_1.SEARCH_MS.TCP_PORT,
            deserializer: new incoming_request_deserializer_1.IncomingRequestDeserializer(),
        },
    });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
    await app.listen();
    console.log(`Search microservice is listening on ${search_messages_1.SEARCH_MS.TCP_HOST}:${search_messages_1.SEARCH_MS.TCP_PORT}`);
}
bootstrap().catch((error) => {
    console.error('Failed to start Search microservice:', error);
    process.exit(1);
});
//# sourceMappingURL=main.search.js.map
