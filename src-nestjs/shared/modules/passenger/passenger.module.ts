import { Module } from '@nestjs/common';
import { PassengerPricingService } from '../../services/passenger-pricing.service';

@Module({
    providers: [PassengerPricingService],
    exports: [PassengerPricingService],
})
export class PassengerModule {}
