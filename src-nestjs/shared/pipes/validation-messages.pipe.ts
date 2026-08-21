import {
    type ArgumentMetadata,
    BadRequestException,
    Injectable,
    type PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AUTH_MESSAGES, COMMON_MESSAGES } from 'src/shared/constants/messages';

/**
 * Custom Validation Pipe that uses messages from centralized message system
 * This pipe transforms validation errors to use messages from our message constants
 */
@Injectable()
export class ValidationMessagesPipe implements PipeTransform<any> {
    async transform(value: any, { metatype }: ArgumentMetadata) {
        if (!metatype || !this.toValidate(metatype)) {
            return value;
        }

        const object = plainToInstance(metatype, value);
        const errors = await validate(object, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        if (errors.length > 0) {
            const messages = this.formatValidationErrors(errors);
            throw new BadRequestException({
                statusCode: 400,
                message: messages,
                error: 'Validation Failed',
            });
        }

        return object;
    }

    private toValidate(metatype: object): boolean {
        const types: (object | string | number | boolean)[] = [
            String,
            Boolean,
            Number,
            Array,
            Object,
        ];
        return !types.includes(metatype);
    }

    private formatValidationErrors(errors: any[]): string[] {
        const messages: string[] = [];

        errors.forEach((error) => {
            if (error.constraints) {
                Object.values(error.constraints).forEach((constraint: string) => {
                    // Map common validation messages to our centralized messages
                    const mappedMessage = this.mapValidationMessage(constraint, error.property);
                    messages.push(mappedMessage);
                });
            }

            // Handle nested validation errors
            if (error.children && error.children.length > 0) {
                const nestedMessages = this.formatValidationErrors(error.children);
                messages.push(...nestedMessages);
            }
        });

        return messages;
    }

    private mapValidationMessage(constraint: string, property: string): string {
        // Map common validation constraints to our messages
        if (constraint.includes('must be a string')) {
            return `${property} ${COMMON_MESSAGES.VALIDATION.ID_INVALID}`;
        }
        if (constraint.includes('must be an email')) {
            return AUTH_MESSAGES.VALIDATION.EMAIL_INVALID;
        }
        if (constraint.includes('must be longer than')) {
            if (property === 'password') {
                return AUTH_MESSAGES.VALIDATION.PASSWORD_REQUIRED;
            }
            if (property === 'fullname') {
                return AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED;
            }
        }
        if (constraint.includes('must be shorter than')) {
            if (property === 'password') {
                return AUTH_MESSAGES.VALIDATION.PASSWORD_TOO_WEAK;
            }
        }
        if (constraint.includes('should not be empty')) {
            if (property === 'email') {
                return AUTH_MESSAGES.VALIDATION.EMAIL_REQUIRED;
            }
            if (property === 'password') {
                return AUTH_MESSAGES.VALIDATION.PASSWORD_REQUIRED;
            }
            if (property === 'fullname') {
                return AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED;
            }
            if (property === 'phone') {
                return AUTH_MESSAGES.VALIDATION.PHONE_REQUIRED;
            }
        }
        if (constraint.includes('Vietnamese phone')) {
            return AUTH_MESSAGES.VALIDATION.PHONE_INVALID;
        }

        // Return original constraint if no mapping found
        return constraint;
    }
}
