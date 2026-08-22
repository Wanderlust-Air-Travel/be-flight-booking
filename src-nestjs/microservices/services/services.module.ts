import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplyPromotionHandler, GetDealsHandler } from './application/handlers/services.handlers';
import { Deal } from 'src/api-gateway/data-access/entities/deal/deal.entity';
import { Promotion } from 'src/api-gateway/data-access/entities/deal/promotion.entity';
import { ServicesRepositoryAdapter } from './infrastructure/adapters/services-repository.adapter';
import { ServicesMessageHandler } from './interface/services.message-handler';

@Module({
    imports: [TypeOrmModule.forFeature([Deal, Promotion])],
    controllers: [ServicesMessageHandler],
    providers: [
        GetDealsHandler,
        ApplyPromotionHandler,
        {
            provide: 'IServicesPort',
            useClass: ServicesRepositoryAdapter,
        },
    ],
})
export class ServicesModule {}
