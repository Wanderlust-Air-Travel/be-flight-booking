import { Module } from '@nestjs/common';
import { ApplyPromotionHandler, GetDealsHandler } from './application/handlers/services.handlers';
import { ServicesMessageHandler } from './interface/services.message-handler';

@Module({
    controllers: [ServicesMessageHandler],
    providers: [GetDealsHandler, ApplyPromotionHandler],
})
export class ServicesModule {}