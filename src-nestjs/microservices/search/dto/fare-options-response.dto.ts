import { ApiProperty } from '@nestjs/swagger';
import { CabinType } from 'src/shared/constants/enums';
import { FareOptionDto } from './fare-option.dto';

export class FareOptionsGroupDto {
    @ApiProperty({
        description: 'Group ID',
        example: 1,
    })
    id!: number;

    @ApiProperty({
        enum: CabinType,
        description: 'Cabin type',
        example: CabinType.ECONOMY,
    })
    type!: CabinType;

    @ApiProperty({
        description: 'Group code',
        example: 1,
    })
    code!: number;

    @ApiProperty({
        type: [FareOptionDto],
        description: 'List of fare options',
    })
    list!: FareOptionDto[];
}

export class FareOptionsResponseDto {
    @ApiProperty({
        description: 'Flight instance ID',
        example: 'a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b',
    })
    flightInstanceId!: string;

    @ApiProperty({
        enum: CabinType,
        description: 'Cabin type requested',
        example: CabinType.ECONOMY,
    })
    cabinType!: CabinType;

    @ApiProperty({
        type: [FareOptionDto],
        description:
            'List of available fare options (cabins) for this flight instance and cabin type',
    })
    fareOptions!: FareOptionDto[];
}
