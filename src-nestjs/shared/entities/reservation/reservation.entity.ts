import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../user/user.entity';
import { Currency } from '../currency/currency.entity';

@Entity({ name: 'Reservations', schema: 'dbo' })
export class Reservation {
	@PrimaryColumn('uniqueidentifier')
	reservation_id: string;

	@Index({ unique: true })
	@Column({ type: 'varchar', length: 6, nullable: false, unique: true })
	reservation_code: string;

	@ManyToOne(() => User, { nullable: true })
	@JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
	user: User | null;

	@Column({ type: 'nvarchar', length: 'MAX', nullable: false })
	segments_json: string; // JSON array of segments

	@Column({ type: 'int', nullable: false })
	number_of_passengers: number;

	@Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
	total_amount: number;

	@ManyToOne(() => Currency, { nullable: false })
	@JoinColumn({ name: 'currency_code', referencedColumnName: 'currency_code' })
	currency: Currency;

	@Index()
	@Column({ type: 'varchar', length: 20, nullable: false, default: 'pending' })
	status: string; // pending/expired/converted/cancelled

	@Index()
	@Column({ type: 'datetime2', nullable: false })
	expires_at: Date;

	@CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
	created_at: Date;

	@Column({ type: 'datetime2', nullable: true })
	converted_at: Date | null; // When booking is created from this reservation
}

