import {
    type ValidationArguments,
    type ValidationOptions,
    registerDecorator,
} from 'class-validator';
import { COMMON_MESSAGES } from 'src/shared/constants/messages';

export function IsUUIDv7(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string) => {
        registerDecorator({
            name: 'isUuidV7',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: unknown, _args: ValidationArguments) {
                    if (typeof value !== 'string') {
                        return false;
                    }
                    // UUID v7: version=7 at position 14, variant bits at position 19 (first char of 4th group)
                    const uuidV7Regex =
                        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                    return uuidV7Regex.test(value);
                },
                defaultMessage(args: ValidationArguments) {
                    if (validationOptions?.message) {
                        return typeof validationOptions.message === 'string'
                            ? validationOptions.message
                            : validationOptions.message(args);
                    }
                    return COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7;
                },
            },
        });
    };
}
