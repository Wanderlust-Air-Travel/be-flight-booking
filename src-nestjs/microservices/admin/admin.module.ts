import { Module } from '@nestjs/common';
import { GetAuditLogsHandler, GetDashboardHandler, ManageFlightsHandler } from './application/handlers/admin.handlers';
import { AdminMessageHandler } from './interface/admin.message-handler';

@Module({
    controllers: [AdminMessageHandler],
    providers: [GetDashboardHandler, GetAuditLogsHandler, ManageFlightsHandler],
})
export class AdminModule {}