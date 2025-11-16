import { Passenger } from "src/domain/passenger/entity/passenger.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Booking } from "src/domain/booking/entity/booking.entity";

@Entity({ name: 'Users', schema: 'dbo' })
export class User {
	@PrimaryGeneratedColumn('uuid')
	user_id: string;

	@Column({ nullable: false, length: 100 })
	fullname: string;

	@Column({ unique: true, nullable: false, length: 100 })
	email: string;

	@Column({ nullable: false, length: 255 })
	password_hash: string;

	@Column({ nullable: true, length: 20 })
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
}