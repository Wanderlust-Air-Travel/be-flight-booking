import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Route } from 'src/shared/entities/route/route.entity';
import type { Repository } from 'typeorm';
import type { UploadImageRequestDto } from './dto/upload-image-request.dto';
import type { UploadImageResponseDto } from './dto/upload-image-response.dto';

@Injectable()
export class RoutesService {
    constructor(
        @InjectRepository(Route)
        private readonly _routeRepo: Repository<Route>
    ) {}

    /**
     * Update image URL for a route
     * @param dto Upload image request DTO
     * @returns Upload image response DTO
     * @throws NotFoundException if route not found
     */
    async uploadImage(dto: UploadImageRequestDto): Promise<UploadImageResponseDto> {
        const result = await this.routeRepo.update(
            { route_id: dto.routeId },
            { image_url: dto.imageUrl }
        );

        if (result.affected === 0) {
            throw new NotFoundException(`Route with ID ${dto.routeId} not found`);
        }

        return {
            imageUrl: dto.imageUrl,
            message: 'Image uploaded successfully',
        };
    }
}
