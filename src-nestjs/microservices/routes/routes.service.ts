import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Route } from 'src/shared/entities/route/route.entity';
import type { Repository } from 'typeorm';
import { UploadImageRequestDto } from './dto/upload-image-request.dto';
import { UploadImageResponseDto } from './dto/upload-image-response.dto';

@Injectable()
export class RoutesService {
    constructor(
        @InjectRepository(Route)
        private readonly _routeRepo: Repository<Route>
    ) {}

    private get routeRepo(): Repository<Route> {
        return this._routeRepo;
    }

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
