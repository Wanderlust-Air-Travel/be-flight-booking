import { ValueObject } from '../../../../shared/domain/base/value-object';
import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';

/**
 * ReservationSegment — One leg of a multi-segment reservation.
 * Replaces the legacy `segments_json nvarchar(MAX)` column.
 */
export class ReservationSegment extends ValueObject<{
    flightInstanceId: string;
    fareClassCode: string;
    cabinType: string;
    passengerCount: number;
}> {
    private constructor(value: {
        flightInstanceId: string;
        fareClassCode: string;
        cabinType: string;
        passengerCount: number;
    }) {
        super(value);
    }

    static create(input: {
        flightInstanceId: string;
        fareClassCode: string;
        cabinType: string;
        passengerCount: number;
    }): ReservationSegment {
        if (!input.flightInstanceId || !input.fareClassCode || !input.cabinType) {
            throw new DomainException('ReservationSegment: missing required fields');
        }
        if (input.passengerCount <= 0) {
            throw new DomainException(
                `ReservationSegment: passengerCount must be > 0, got: ${input.passengerCount}`
            );
        }
        return new ReservationSegment(input);
    }

    get flightInstanceId(): string {
        return this.value.flightInstanceId;
    }
    get fareClassCode(): string {
        return this.value.fareClassCode;
    }
    get cabinType(): string {
        return this.value.cabinType;
    }
    get passengerCount(): number {
        return this.value.passengerCount;
    }
}