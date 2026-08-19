import { Inject, Injectable } from '@nestjs/common';

export interface AdminDashboardQuery {
    periodDays: number;
}

export interface AdminDashboardData {
    totalBookings: number;
    totalRevenue: number;
    activeUsers: number;
    topRoutes: Array<{ route: string; bookings: number }>;
    generatedAt: string;
}

export interface AuditLog {
    id: string;
    actor: string;
    action: string;
    targetType: string;
    targetId: string;
    timestamp: Date;
    metadata: Record<string, unknown>;
}

export interface IAdminPort {
    getDashboard(periodDays: number): Promise<AdminDashboardData>;
    getAuditLogs(limit: number, offset: number): Promise<{ items: AuditLog[]; total: number }>;
    manageFlights(action: 'create' | 'update' | 'delete', payload: any): Promise<{ ok: boolean }>;
}

@Injectable()
export class GetDashboardHandler {
    constructor(@Inject('IAdminPort') private readonly port: IAdminPort) {}

    async execute(query: AdminDashboardQuery): Promise<AdminDashboardData> {
        return this.port.getDashboard(query.periodDays);
    }
}

@Injectable()
export class GetAuditLogsHandler {
    constructor(@Inject('IAdminPort') private readonly port: IAdminPort) {}

    async execute(query: { limit: number; offset: number }): Promise<{ items: AuditLog[]; total: number }> {
        return this.port.getAuditLogs(query.limit, query.offset);
    }
}

@Injectable()
export class ManageFlightsHandler {
    constructor(@Inject('IAdminPort') private readonly port: IAdminPort) {}

    async execute(input: { action: 'create' | 'update' | 'delete'; payload: any }): Promise<{ ok: boolean }> {
        if (!['create', 'update', 'delete'].includes(input.action)) {
            throw new Error(`Unknown action: ${input.action}`);
        }
        return this.port.manageFlights(input.action, input.payload);
    }
}