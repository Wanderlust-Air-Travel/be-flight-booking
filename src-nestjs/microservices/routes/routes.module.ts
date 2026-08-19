import { Module } from '@nestjs/common';
import { GetFlightScheduleHandler, GetRoutesHandler } from '../application/handlers/routes.handlers';
import { RoutesMessageHandler } from '../interface/routes.message-handler';

@Module({
    controllers: [RoutesMessageHandler],
    providers: [GetRoutesHandler, GetFlightScheduleHandler],
})
export class RoutesModule {}