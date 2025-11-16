import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Booking } from "./booking.entity";
import { Passenger } from "src/domain/passenger/entity/passenger.entity";

@Entity({ name: 'BookingPassengers', schema: 'dbo' })
@Unique('UQ_BookingPassengers_Booking_Passenger', ['booking', 'passenger'])
export class BookingPassenger {
	@PrimaryGeneratedColumn('uuid')
	booking_passenger_id: string;

	@ManyToOne(() => Booking, (b) => b.booking_passengers, { onDelete: 'CASCADE', nullable: false })
	@JoinColumn({ name: 'booking_id', referencedColumnName: 'booking_id' })
	booking: Booking;

	@ManyToOne(() => Passenger, { nullable: false })
	@JoinColumn({ name: 'passenger_id', referencedColumnName: 'passenger_id' })
	passenger: Passenger;

	@Column({ type: 'varchar', length: 10, nullable: false })
	passenger_type: string; // ADT/CHD/INF
}


