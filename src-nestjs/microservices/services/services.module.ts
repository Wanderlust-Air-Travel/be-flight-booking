import { Module } from '@nestjs/common';
import { ApplyPromotionHandler, GetDealsHandler } from './application/handlers/services.handlers';
import { ServicesMockAdapter } from './infrastructure/adapters/services-mock.adapter';
import { ServicesMessageHandler } from './interface/services.message-handler';

@Module({
    controllers: [ServicesMessageHandler],
    providers: [
        GetDealsHandler,
        ApplyPromotionHandler,
        {
            provide: 'IServicesPort',
            useClass: ServicesMockAdapter,
        },
    ],
})
export class ServicesModule {}
