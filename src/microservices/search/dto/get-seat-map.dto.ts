import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { CabinType } from 'src/shared/constants/enums';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class GetSeatMapDto {
	@ApiProperty({
		description: 'Flight instance ID (UUID v7 - time-ordered)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@Transform(({ value }) => {
		if (typeof value === 'string') {
			return value.trim();
		}
		return value;
	})
	@IsNotEmpty()
	@IsUUIDv7({ message: 'flightInstanceId must be a valid UUID v7' })
	flightInstanceId!: string;

	@ApiProperty({
		enum: CabinType,
		description: 'Cabin type: economy or business',
		example: CabinType.ECONOMY,
	})
	@IsNotEmpty()
	@IsEnum(CabinType)
	cabinType!: CabinType;
}

