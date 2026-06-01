import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { AUTH_MESSAGES } from 'src/shared/constants/messages';

/**
 * Custom validator for Vietnamese phone numbers
 * Supports formats: 09xxxxxxxx, 08xxxxxxxx, 07xxxxxxxx, 03xxxxxxxx, 05xxxxxxxx
 * Length: 10 digits (without country code) or 11 digits
 */
export function IsVietnamesePhone(validationOptions?: ValidationOptions) {
	return function (object: Object, propertyName: string) {
		registerDecorator({
			name: 'isVietnamesePhone',
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			validator: {
				validate(value: any, args: ValidationArguments) {
					if (typeof value !== 'string') {
						return false;
					}
					// Vietnamese phone number: starts with 0, followed by 9 digits (total 10)
					// Or: starts with 84 (country code), followed by 9 digits (total 11)
					const vietnamesePhoneRegex = /^(0|84)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-6|8|9]|9[0-4|6-9])[0-9]{7}$/;
					return vietnamesePhoneRegex.test(value.replace(/\s+/g, ''));
				},
				defaultMessage(args: ValidationArguments): string {
					if (validationOptions?.message) {
						return typeof validationOptions.message === 'string'
							? validationOptions.message
							: validationOptions.message(args);
					}
					return AUTH_MESSAGES.VALIDATION.PHONE_INVALID;
				},
			},
		});
	};
}