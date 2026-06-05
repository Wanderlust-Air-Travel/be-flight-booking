import { ApiProperty } from '@nestjs/swagger';

export class UploadImageResponseDto {
    @ApiProperty({
        example: '/images/routes/019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg',
        description: 'Path to uploaded image',
    })
    imageUrl: string;

    @ApiProperty({
        example: 'Image uploaded successfully',
        description: 'Success message',
    })
    message: string;
}
