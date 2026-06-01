import {
	registerDecorator,
	ValidationOptions,
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator to ensure that if passengerId is not provided,
 * then fullname, dob, gender, and documentNumber must be provided
 */
@ValidatorConstraint({ name: 'isPassengerInfoValid', async: false })
export class IsPassengerInfoValidConstraint implements ValidatorConstraintInterface {
	validate(value: any, args: ValidationArguments) {
		const object = args.object as any;
		const passengerId = object.passengerId;
		const fullname = object.fullname;
		const dob = object.dob;
		const gender = object.gender;
		const documentNumber = object.documentNumber;

		// If passengerId is provided, passenger info is not required
		if (passengerId) {
			return true;
		}

		// If passengerId is not provided, all passenger info must be provided
		if (!fullname || !dob || !gender || !documentNumber) {
			return false;
		}

		return true;
	}

	defaultMessage(args: ValidationArguments) {
		return 'If passengerId is not provided, fullname, dob, gender, and documentNumber are required';
	}
}

/**
 * Decorator to validate passenger info
 * - If passengerId is provided → OK
 * - If passengerId is not provided → fullname, dob, gender, documentNumber must be provided
 */
export function IsPassengerInfoValid(validationOptions?: ValidationOptions) {
	return function (object: Object, propertyName: string) {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsPassengerInfoValidConstraint,
		});
	};
}

