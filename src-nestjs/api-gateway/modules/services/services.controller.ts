import { Controller, Get } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { SERVICES_MS } from 'src/microservices/services/services.messages';
import { GetDealsResponseDto } from 'src/microservices/services/dto/get-deals-response.dto';

@ApiTags('services')
@Controller('services')
export class ServicesController {
    private get client(): ClientProxy {
        return this._client;
    }

    constructor(@Inject('SERVICES_CLIENT') private readonly _client: ClientProxy) {}

    @Get('deals')
    @ApiOperation({
        summary: 'Get flight deals',
        description: 'Get list of available flight deals with routes, dates, and prices',
    })
    @ApiOkResponse({
        description: 'List of flight deals',
        type: GetDealsResponseDto,
    })
    async getDeals(): Promise<GetDealsResponseDto> {
        try {
            return await firstValueFrom(
                this.client.send<GetDealsResponseDto>(SERVICES_MS.PATTERN.GET_DEALS, {})
            );
        } catch (error: any) {
            console.error('Get deals error:', error);
            if (error?.statusCode && error?.message) {
                throw error;
            }
            if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
                throw new Error(
                    'Services microservice is not running. Please start it with: npm run start:services'
                );
            }
            if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
                throw new Error(
                    'Services microservice request timeout. Please check if the service is running.'
                );
            }
            throw new Error(`Get deals failed: ${error?.message || 'Unknown error'}`);
        }
    }
}
