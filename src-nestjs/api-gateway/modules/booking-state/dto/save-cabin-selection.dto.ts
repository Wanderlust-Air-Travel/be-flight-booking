import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { COMMON_MESSAGES } from 'src/shared/constants/messages';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class SaveCabinSelectionDto {
    @ApiProperty({
        description: 'Flight instance ID',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @IsNotEmpty({ message: COMMON_MESSAGES.VALIDATION.ID_REQUIRED })
    @IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
    flightInstanceId!: string;

    @ApiProperty({
        description: 'Cabin type',
        enum: ['economy', 'business'],
        example: 'economy',
    })
    @IsNotEmpty()
    @IsEnum(['economy', 'business'])
    cabinType!: 'economy' | 'business';

    @ApiProperty({
        description: 'Fare class code (from search/fare-options API)',
        example: 'YS',
    })
    @IsNotEmpty()
    @IsString()
    fareClassCode!: string;
}
