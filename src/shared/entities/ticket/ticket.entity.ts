import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Booking } from "src/shared/entities/booking/booking.entity";
import { BookingPassenger } from "src/shared/entities/booking/booking-passenger.entity";

@Entity({ name: 'Tickets', schema: 'dbo' })
export class Ticket {
	@PrimaryColumn('uniqueidentifier')
	ticket_id: string;

	@ManyToOne(() => Booking, (b) => b.tickets, { onDelete: 'CASCADE', nullable: false })
	@JoinColumn({ name: 'booking_id', referencedColumnName: 'booking_id' })
	booking: Booking;

	@ManyToOne(() => BookingPassenger, { nullable: false })
	@JoinColumn({ name: 'booking_passenger_id', referencedColumnName: 'booking_passenger_id' })
	booking_passenger: BookingPassenger;

	@Index({ unique: true })
	@Column({ type: 'varchar', length: 20, unique: true, nullable: false })
	ticket_number: string;

	@CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
	issued_at: Date;

	@Column({ type: 'varchar', length: 20, nullable: false, default: 'active' })
	status: string;
}


