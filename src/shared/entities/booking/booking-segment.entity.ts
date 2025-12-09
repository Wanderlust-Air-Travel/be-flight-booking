import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, OneToMany } from "typeorm";
import { Booking } from "./booking.entity";
import { BookingPassenger } from "./booking-passenger.entity";
import { FlightInstance } from "src/shared/entities/flight/flight-instance.entity";
import { FlightSeat } from "src/shared/entities/flight/flight-seat.entity";
import { FareClass } from "src/shared/entities/fare/fare-class.entity";
import { BookingSegmentService } from "./booking-segment-service.entity";

@Entity({ name: 'BookingSegments', schema: 'dbo' })
export class BookingSegment {
	@PrimaryColumn('uniqueidentifier')
	booking_segment_id: string;

	@ManyToOne(() => Booking, (b) => b.booking_segments, { onDelete: 'CASCADE', nullable: false })
	@JoinColumn({ name: 'booking_id', referencedColumnName: 'booking_id' })
	booking: Booking;

	@ManyToOne(() => BookingPassenger, { nullable: false })
	@JoinColumn({ name: 'booking_passenger_id', referencedColumnName: 'booking_passenger_id' })
	booking_passenger: BookingPassenger;

	@ManyToOne(() => FlightInstance, { nullable: false })
	@JoinColumn({ name: 'flight_instance_id', referencedColumnName: 'flight_instance_id' })
	flight_instance: FlightInstance;

	@ManyToOne(() => FlightSeat, { nullable: true })
	@JoinColumn({ name: 'flight_seat_id', referencedColumnName: 'flight_seat_id' })
	flight_seat: FlightSeat | null;

	@ManyToOne(() => FareClass, { nullable: false })
	@JoinColumn({ name: 'fare_class_code', referencedColumnName: 'fare_class_code' })
	fare_class: FareClass;

	@Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
	base_fare: number;

	@Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
	tax_amount: number;

	@Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
	fee_amount: number;

	@Column({ type: 'varchar', length: 20, nullable: false, default: 'booked' })
	status: string;

	@OneToMany(() => BookingSegmentService, (bss) => bss.booking_segment)
	services: BookingSegmentService[];
}


