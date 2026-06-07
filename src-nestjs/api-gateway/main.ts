import { join } from 'node:path';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: ['error', 'warn'], // Chỉ log errors và warnings, tắt RouterExplorer và InstanceLoader logs
    });

    // Enable API versioning
    app.setGlobalPrefix('api');
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    // Enable CORS for frontend
    app.enableCors({
        origin: process.env.FRONTEND_URL || true, // Allow all origins in dev, or set specific URL in production
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'Accept',
            'X-Requested-With',
            'X-Request-Id',
            'X-Correlation-Id',
            'Idempotency-Key',
        ],
        exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-Request-Id', 'X-Correlation-Id'],
        credentials: true, // Allow cookies/credentials
        maxAge: 86400, // 24 hours
    });

    // Serve static files from public directory
    app.useStaticAssets(join(process.cwd(), 'public'), {
        prefix: '/',
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: false,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        })
    );

    // Global exception filter (replaces ValidationExceptionFilter)
    app.useGlobalFilters(new AllExceptionsFilter());

    // Global interceptors
    app.useGlobalInterceptors(new RequestIdInterceptor(), new LoggingInterceptor());

    const config = new DocumentBuilder()
        .setTitle('Flight Booking API')
        .setDescription('API documentation for the flight booking service')
        .setVersion('1.0.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter JWT access token',
                in: 'header',
                name: 'Authorization',
            },
            'access-token'
        )
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);

    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
