import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

/**
 * DTO for route ID parameter validation
 */
export class UploadImageParamDto {
	@ApiProperty({
		description: 'Route ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@Transform(({ value }) => {
		if (typeof value === 'string') {
			return value.trim();
		}
		return value;
	})
	@IsNotEmpty({ message: 'routeId is required' })
	@IsUUIDv7({ message: 'routeId must be a valid UUID v7' })
	routeId!: string;
}

