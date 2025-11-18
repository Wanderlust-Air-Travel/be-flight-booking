import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { Passenger } from "src/shared/entities/passenger/passenger.entity";
import { Booking } from "src/shared/entities/booking/booking.entity";
import { Reservation } from "src/shared/entities/reservation/reservation.entity";

@Entity({ name: 'Users', schema: 'dbo' })
export class User {
	@PrimaryColumn('uniqueidentifier')
	user_id: string;

	@Column({ type: 'nvarchar', nullable: false, length: 100 })
	fullname: string;

	@Column({ type: 'varchar', unique: true, nullable: false, length: 100 })
	email: string;

	@Column({ type: 'varchar', nullable: false, length: 255 })
	password_hash: string;

	@Column({ type: 'varchar', nullable: true, length: 20 })
	phone: string | null;

	@CreateDateColumn({ nullable: false, type: 'datetime2', default: () => 'SYSDATETIME()' })
	created_at: Date;

	@UpdateDateColumn({ nullable: true, type: 'datetime2'})
	updated_at: Date | null;

	@Column({type: 'varchar', nullable: true, length: 255})
	refresh_token: string | null;

	@Column({type: 'datetime2', nullable: true})
	refresh_token_expires_at: Date | null;

	@Column({type: 'varchar', nullable: true, length: 255})
	forgot_password_token: string | null;

	@Column({type: 'datetime2', nullable: true})
	forgot_password_token_expires_at: Date | null;

	@Column({ type: 'bit', nullable: false, default: () => '1' })
	is_active: boolean;

	// 1 User -> N Passengers
	@OneToMany(() => Passenger, (p) => p.user, { cascade: false })
	passengers: Passenger[];

	// 1 User -> N Bookings (nullable user_id in Bookings)
	@OneToMany(() => Booking, (b) => b.user, { cascade: false })
	bookings: Booking[];

	// 1 User -> N Reservations (nullable user_id in Reservations)
	@OneToMany(() => Reservation, (r) => r.user, { cascade: false })
	reservations: Reservation[];
}