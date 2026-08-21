import { IsNotEmpty, IsString } from 'class-validator';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class UploadImageRequestDto {
    @IsNotEmpty()
    @IsString()
    @IsUUIDv7({ message: 'routeId must be a valid UUID v7' })
    routeId!: string;

    @IsNotEmpty()
    @IsString()
    imageUrl!: string; // Path to uploaded image: /images/routes/{routeId}.jpg
}
