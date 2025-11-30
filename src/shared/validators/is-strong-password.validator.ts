import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { AUTH_MESSAGES } from 'src/shared/constants/messages';

/**
 * Custom validator for strong password
 * Requirements:
 * - Minimum 6 characters, maximum 20 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
	return function (object: Object, propertyName: string) {
		registerDecorator({
			name: 'isStrongPassword',
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			validator: {
				validate(value: any, args: ValidationArguments) {
					if (typeof value !== 'string') {
						return false;
					}
					// Minimum 6 characters, maximum 20 characters
					if (value.length < 6 || value.length > 20) {
						return false;
					}
					// At least one uppercase letter
					if (!/[A-Z]/.test(value)) {
						return false;
					}
					// At least one lowercase letter
					if (!/[a-z]/.test(value)) {
						return false;
					}
					// At least one number
					if (!/[0-9]/.test(value)) {
						return false;
					}
					// At least one special character
					if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
						return false;
					}
					return true;
				},
				defaultMessage(args: ValidationArguments) {
					return validationOptions?.message || AUTH_MESSAGES.VALIDATION.PASSWORD_TOO_WEAK;
				},
			},
		});
	};
}

