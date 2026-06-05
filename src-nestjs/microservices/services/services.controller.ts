import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { GetDealsResponseDto } from './dto/get-deals-response.dto';
import { SERVICES_MS } from './services.messages';
import type { ServicesService } from './services.service';

@Controller()
export class ServicesMsController {
    constructor(private readonly servicesService: ServicesService) {}

    @MessagePattern(SERVICES_MS.PATTERN.GET_DEALS)
    async getDeals(): Promise<GetDealsResponseDto> {
        return this.servicesService.getDeals();
    }
}
