import {
    type ValidationArguments,
    type ValidationOptions,
    ValidatorConstraint,
    type ValidatorConstraintInterface,
    registerDecorator,
} from 'class-validator';

@ValidatorConstraint({ name: 'isPassengerInfoValid', async: false })
export class IsPassengerInfoValidConstraint implements ValidatorConstraintInterface {
    validate(_value: unknown, args: ValidationArguments) {
        const object = args.object as Record<string, unknown>;
        const passengerId = object.passengerId;
        const fullname = object.fullname;
        const dob = object.dob;
        const gender = object.gender;
        const documentNumber = object.documentNumber;

        if (passengerId) {
            return true;
        }

        if (!fullname || !dob || !gender || !documentNumber) {
            return false;
        }

        return true;
    }

    defaultMessage(_args: ValidationArguments) {
        return 'If passengerId is not provided, fullname, dob, gender, and documentNumber are required';
    }
}

export function IsPassengerInfoValid(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsPassengerInfoValidConstraint,
        });
    };
}
