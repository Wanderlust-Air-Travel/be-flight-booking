import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type {
    GetFlightScheduleHandler,
    GetRoutesHandler,
} from '../application/handlers/routes.handlers';

@Controller()
export class RoutesMessageHandler {
    constructor(
        private readonly getRoutesHandler: GetRoutesHandler,
        private readonly getFlightScheduleHandler: GetFlightScheduleHandler
    ) {}

    @MessagePattern('get_routes')
    async getRoutes(): Promise<any> {
        return this.getRoutesHandler.execute();
    }

    @MessagePattern('get_flight_schedule')
    async getFlightSchedule(payload: { routeId: string }): Promise<any> {
        return this.getFlightScheduleHandler.execute(payload.routeId);
    }
}
