import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { CabinType } from 'src/shared/constants/enums';
import { COMMON_MESSAGES, SEARCH_MESSAGES } from 'src/shared/constants/messages';
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
    @IsNotEmpty({ message: SEARCH_MESSAGES.VALIDATION.FLIGHT_INSTANCE_ID_REQUIRED })
    @IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
    flightInstanceId!: string;

    @ApiProperty({
        enum: CabinType,
        description:
            'Cabin type: economy or business. Optional - if not provided, backend will automatically fetch from booking state (if cabin selection was saved).',
        example: CabinType.ECONOMY,
        required: false,
    })
    @IsOptional()
    @IsEnum(CabinType)
    cabinType?: CabinType;
}
