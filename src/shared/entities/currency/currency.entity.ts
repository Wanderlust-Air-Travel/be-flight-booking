import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { Booking } from "../booking/booking.entity";
import { Payment } from "../payment/payment.entity";
import { Reservation } from "../reservation/reservation.entity";

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


