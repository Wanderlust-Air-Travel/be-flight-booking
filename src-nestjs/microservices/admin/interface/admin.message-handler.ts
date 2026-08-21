import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type {
    GetAuditLogsHandler,
    GetDashboardHandler,
    ManageFlightsHandler,
} from '../application/handlers/admin.handlers';

@Controller()
export class AdminMessageHandler {
    constructor(
        private readonly getDashboardHandler: GetDashboardHandler,
        private readonly getAuditLogsHandler: GetAuditLogsHandler,
        private readonly manageFlightsHandler: ManageFlightsHandler
    ) {}

    @MessagePattern('admin_get_dashboard')
    async getDashboard(payload: any): Promise<any> {
        return this.getDashboardHandler.execute({ periodDays: payload?.periodDays ?? 30 });
    }

    @MessagePattern('admin_get_audit_logs')
    async getAuditLogs(payload: any): Promise<any> {
        return this.getAuditLogsHandler.execute({
            limit: payload?.limit ?? 50,
            offset: payload?.offset ?? 0,
        });
    }

    @MessagePattern('admin_manage_flights')
    async manageFlights(payload: any): Promise<any> {
        return this.manageFlightsHandler.execute({
            action: payload.action,
            payload: payload.payload,
        });
    }
}
