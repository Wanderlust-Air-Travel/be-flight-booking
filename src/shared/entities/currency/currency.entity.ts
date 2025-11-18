import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { Booking } from "src/shared/entities/booking/booking.entity";
import { Payment } from "src/shared/entities/payment/payment.entity";
import { Reservation } from "src/shared/entities/reservation/reservation.entity";

@Entity({ name: 'Currencies', schema: 'dbo' })
export class Currency {
	@PrimaryColumn({ type: 'char', length: 3 })
	currency_code: string;

	@Column({ type: 'nvarchar', length: 50, nullable: false })
	name: string;

	@OneToMany(() => Booking, (b) => b.currency)
	bookings: Booking[];

	@OneToMany(() => Payment, (p) => p.currency)
	payments: Payment[];

	@OneToMany(() => Reservation, (r) => r.currency)
	reservations: Reservation[];
}


