import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class SaveCabinSelectionDto {
    @ApiProperty({
        description: 'Flight instance ID',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @IsNotEmpty({ message: 'flightInstanceId is required.' })
    @IsUUIDv7({ message: 'flightInstanceId must be a valid UUID v7.' })
    flightInstanceId!: string;

    @ApiProperty({
        description: 'Cabin type',
        enum: ['economy', 'business'],
        example: 'economy',
    })
    @IsNotEmpty({ message: 'cabinType is required.' })
    @IsEnum(['economy', 'business'], {
        message: 'cabinType must be either "economy" or "business".',
    })
    cabinType!: 'economy' | 'business';

    @ApiProperty({
        description:
            'Fare class code (from search/fare-options API). Economy codes start with "Y" (e.g. YS, YF, YSM); business codes start with "J" (e.g. JS, JF, JFLX).',
        example: 'YS',
    })
    @IsNotEmpty({ message: 'fareClassCode is required.' })
    @IsString({ message: 'fareClassCode must be a string.' })
    fareClassCode!: string;
}
