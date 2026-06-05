import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { UploadImageRequestDto } from './dto/upload-image-request.dto';
import type { UploadImageResponseDto } from './dto/upload-image-response.dto';
import { ROUTES_MS } from './routes.messages';
import type { RoutesService } from './routes.service';

@Controller()
export class RoutesMsController {
    constructor(private readonly routesService: RoutesService) {}

    @MessagePattern(ROUTES_MS.PATTERN.UPLOAD_IMAGE)
    async uploadImage(@Payload() dto: UploadImageRequestDto): Promise<UploadImageResponseDto> {
        return this.routesService.uploadImage(dto);
    }
}
