import { Module } from '@nestjs/common';
import { GetFlightScheduleHandler, GetRoutesHandler } from './application/handlers/routes.handlers';
import { TypeOrmRouteQueryAdapter } from './infrastructure/adapters/typeorm-route-query.adapter';
import { RoutesMessageHandler } from './interface/routes.message-handler';

/**
 * RoutesModule — Wires the routes bounded context.
 *
 * IRouteQueryPort is bound to TypeOrmRouteQueryAdapter, which reads
 * routes, airports, and flight instances/schedules from SQL Server.
 */
@Module({
    controllers: [RoutesMessageHandler],
    providers: [
        TypeOrmRouteQueryAdapter,
        {
            provide: 'IRouteQueryPort',
            useClass: TypeOrmRouteQueryAdapter,
        },
        GetRoutesHandler,
        GetFlightScheduleHandler,
    ],
})
export class RoutesModule {}
