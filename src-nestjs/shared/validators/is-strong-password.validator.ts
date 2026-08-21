import {
    type ValidationArguments,
    type ValidationOptions,
    registerDecorator,
} from 'class-validator';
import { AUTH_MESSAGES } from 'src/shared/constants/messages';

export function IsStrongPassword(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string) => {
        registerDecorator({
            name: 'isStrongPassword',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: unknown, _args: ValidationArguments) {
                    if (typeof value !== 'string') {
                        return false;
                    }
                    if (value.length < 6 || value.length > 20) {
                        return false;
                    }
                    if (!/[A-Z]/.test(value)) {
                        return false;
                    }
                    if (!/[a-z]/.test(value)) {
                        return false;
                    }
                    if (!/[0-9]/.test(value)) {
                        return false;
                    }
                    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
                        return false;
                    }
                    return true;
                },
                defaultMessage(args: ValidationArguments): string {
                    if (validationOptions?.message) {
                        return typeof validationOptions.message === 'string'
                            ? validationOptions.message
                            : validationOptions.message(args);
                    }
                    return AUTH_MESSAGES.VALIDATION.PASSWORD_TOO_WEAK;
                },
            },
        });
    };
}
