import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { COMMON_MESSAGES } from 'src/shared/constants/messages';

/**
 * Custom validator for UUID v7 (time-ordered UUID)
 * UUID v7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
 * Version 7 is indicated by the '7' in the version position (13th character)
 */
export function IsUUIDv7(validationOptions?: ValidationOptions) {
	return function (object: Object, propertyName: string) {
		registerDecorator({
			name: 'isUuidV7',
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			validator: {
				validate(value: any, args: ValidationArguments) {
					if (typeof value !== 'string') {
						return false;
					}
					// UUID v7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
					// Version 7 is indicated by '7' in position 14 (0-indexed: 13)
					const uuidV7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

