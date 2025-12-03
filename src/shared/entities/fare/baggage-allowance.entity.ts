import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn, Index } from "typeorm";
import { FareClass } from "./fare-class.entity";

/**
 * BaggageAllowance Entity
 * Stores baggage allowances (checked and carry-on) for each fare class
 * Supports different allowances for domestic vs international routes
 */
@Entity({ name: 'BaggageAllowances', schema: 'dbo' })
@Index('IDX_BaggageAllowance_FareClass', ['fare_class_code'])
export class BaggageAllowance {
	@PrimaryColumn('uniqueidentifier')
	baggage_allowance_id: string;

	@ManyToOne(() => FareClass, { nullable: false })
	@JoinColumn({ name: 'fare_class_code', referencedColumnName: 'fare_class_code' })
	fare_class: FareClass;

	@Column({ type: 'varchar', length: 5, nullable: false })
	fare_class_code: string;

	/**
	 * Checked baggage allowance (in kg)
	 * NULL means no checked baggage included
	 */
	@Column({ type: 'int', nullable: true })
	checked_baggage_kg: number | null;

	/**
	 * Number of checked baggage pieces allowed
	 * NULL means no checked baggage included
	 */
	@Column({ type: 'int', nullable: true })
	checked_baggage_pieces: number | null;

	/**
	 * Carry-on baggage allowance (in kg)
	 * Default is usually 7kg for most airlines
	 */
	@Column({ type: 'int', nullable: false, default: 7 })
	carry_on_kg: number;

	/**
	 * Number of carry-on pieces allowed
	 * Usually 1 piece
	 */
	@Column({ type: 'int', nullable: false, default: 1 })
	carry_on_pieces: number;

	/**
	 * Maximum dimensions for carry-on (length x width x height in cm)
	 * Format: "55x40x20" or similar
	 */
	@Column({ type: 'nvarchar', length: 50, nullable: true })
	carry_on_dimensions: string | null;

	/**
	 * Whether this allowance applies to domestic routes
	 */
	@Column({ type: 'bit', nullable: false, default: () => '1' })
	is_domestic: boolean;

	/**
	 * Whether this allowance applies to international routes
	 */
	@Column({ type: 'bit', nullable: false, default: () => '1' })
	is_international: boolean;

	/**
	 * Additional notes or restrictions
	 */
	@Column({ type: 'nvarchar', length: 500, nullable: true })
	notes: string | null;

	@CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
	created_at: Date;

	@UpdateDateColumn({ type: 'datetime2', nullable: true })
	updated_at: Date | null;
}

