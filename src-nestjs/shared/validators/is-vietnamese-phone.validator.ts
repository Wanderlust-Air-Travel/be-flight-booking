import {
    type ValidationArguments,
    type ValidationOptions,
    registerDecorator,
} from 'class-validator';
import { AUTH_MESSAGES } from 'src/shared/constants/messages';

export function IsVietnamesePhone(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string) => {
        registerDecorator({
            name: 'isVietnamesePhone',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: unknown, _args: ValidationArguments) {
                    if (typeof value !== 'string') {
                        return false;
                    }
                    const vietnamesePhoneRegex =
                        /^(0|84)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-6|8|9]|9[0-4|6-9])[0-9]{7}$/;
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
