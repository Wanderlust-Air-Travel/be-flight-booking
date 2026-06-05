import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { CabinType } from 'src/shared/constants/enums';
import { COMMON_MESSAGES } from 'src/shared/constants/messages';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class GetFareOptionsDto {
    @ApiProperty({
        description:
            'Flight instance ID (UUID v7 - time-ordered). Optional - if not provided and user is authenticated, backend will automatically fetch from booking state (if cabin selection was saved).',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
        required: false,
    })
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            return value.trim();
        }
        return value;
    })
    @IsOptional()
    @IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
    flightInstanceId?: string;

    @ApiProperty({
        enum: CabinType,
        description:
            'Cabin type: economy or business. Optional - if not provided and user is authenticated, backend will automatically fetch from booking state (if cabin selection was saved).',
        example: CabinType.ECONOMY,
        required: false,
    })
    @IsOptional()
    @IsEnum(CabinType)
    cabinType?: CabinType;
}
