import {
	Controller,
	Post,
	Param,
	UploadedFile,
	UseInterceptors,
	UseGuards,
	BadRequestException,
	HttpCode,
	HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { UploadImageResponseDto } from './dto/upload-image-response.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { multerConfig } from './config/multer.config';
import { ParseUUIDv7Pipe } from './pipes/parse-uuid-v7.pipe';
import { ROUTES_MS } from 'src/microservices/routes/routes.messages';

@ApiTags('routes')
@Controller('routes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class RoutesController {
	constructor(@Inject('ROUTES_CLIENT') private readonly client: ClientProxy) {}

	@Post(':routeId/upload-image')
	@HttpCode(HttpStatus.OK)
	@UseInterceptors(FileInterceptor('image', multerConfig))
	@ApiOperation({
		summary: 'Upload image for route',
		description: 'Upload an image for a specific route. Image will be saved to public/images/routes/ and image_url will be updated in database.',
	})
	@ApiParam({
		name: 'routeId',
		description: 'Route ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
		type: String,
	})
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				image: {
					type: 'string',
					format: 'binary',
					description: 'Image file (JPG, JPEG, PNG, max 5MB)',
				},
			},
		},
	})
	@ApiResponse({
		status: 200,
		description: 'Image uploaded successfully',
		type: UploadImageResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Bad request - Invalid file type, size, or route ID',
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - JWT token required',
	})
	@ApiResponse({
		status: 404,
		description: 'Route not found',
	})
	async uploadImage(
		@Param('routeId', ParseUUIDv7Pipe) routeId: string,
		@UploadedFile() file: Express.Multer.File | undefined,
	): Promise<UploadImageResponseDto> {
		if (!file) {
			throw new BadRequestException('No file uploaded. Please provide an image file.');
		}

		// File is already saved to disk by multer
		// Now send message to Routes Microservice to update database
		const imageUrl = `/images/routes/${routeId}.jpg`;

		try {
			return await firstValueFrom(
				this.client.send<UploadImageResponseDto>(ROUTES_MS.PATTERN.UPLOAD_IMAGE, {
					routeId,
					imageUrl,
				}),
			);
		} catch (error: any) {
			console.error('Upload image error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			if (error?.code === 'ECONNREFUSED' || error?.message?.includes('ECONNREFUSED')) {
				throw new Error('Routes microservice is not running. Please start it with: npm run start:routes');
			}
			if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
				throw new Error('Routes microservice request timeout. Please check if the service is running.');
			}
			throw new Error(`Upload image failed: ${error?.message || 'Unknown error'}`);
		}
	}
}

