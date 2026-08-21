import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

/**
 * Custom pipe to validate and parse UUID v7
 * UUID v7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
 */
@Injectable()
export class ParseUUIDv7Pipe implements PipeTransform<string, string> {
    transform(value: string): string {
        if (!value) {
            throw new BadRequestException('Route ID is required');
        }

        const trimmedValue = value.trim();

        // UUID v7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
        // Version 7 is indicated by '7' in position 14 (0-indexed: 13)
        const uuidV7Regex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidV7Regex.test(trimmedValue)) {
            throw new BadRequestException('Route ID must be a valid UUID v7');
        }

        return trimmedValue;
    }
}
