import { Inject, Injectable } from '@nestjs/common';

export interface RouteSummary {
    routeId: string;
    origin: string;
    destination: string;
    airlineCode: string;
    distanceKm: number;
}

export interface FlightSchedule {
    flightInstanceId: string;
    routeId: string;
    aircraft: string;
    departureTime: Date;
    arrivalTime: Date;
    status: 'SCHEDULED' | 'DELAYED' | 'CANCELLED' | 'COMPLETED';
}

/**
 * IRouteQueryPort — Read port for routes data.
 */
export interface IRouteQueryPort {
    findAllRoutes(): Promise<RouteSummary[]>;
    findRoute(id: string): Promise<RouteSummary | null>;
    findSchedule(routeId: string): Promise<FlightSchedule[]>;
}

@Injectable()
export class GetRoutesHandler {
    constructor(@Inject('IRouteQueryPort') private readonly port: IRouteQueryPort) {}

    async execute(): Promise<RouteSummary[]> {
        return this.port.findAllRoutes();
    }
}

@Injectable()
export class GetFlightScheduleHandler {
    constructor(@Inject('IRouteQueryPort') private readonly port: IRouteQueryPort) {}

    async execute(routeId: string): Promise<FlightSchedule[]> {
        return this.port.findSchedule(routeId);
    }
}
