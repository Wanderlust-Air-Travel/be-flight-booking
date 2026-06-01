import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, CreateDateColumn } from 'typeorm';
import { BookingSegment } from './booking-segment.entity';
import { CabinService } from '../cabin/cabin-service.entity';

/**
 * BookingSegmentService Entity
 * Stores selected cabin services for each booking segment
 * Links booking segments to cabin services that were selected during booking
 */
@Entity({ name: 'BookingSegmentServices', schema: 'dbo' })
export class BookingSegmentService {
	@PrimaryColumn('uniqueidentifier')
	booking_segment_service_id: string;

	@ManyToOne(() => BookingSegment, (bs) => bs.services, { onDelete: 'CASCADE', nullable: false })
	@JoinColumn({ name: 'booking_segment_id', referencedColumnName: 'booking_segment_id' })
	booking_segment: BookingSegment;

	@ManyToOne(() => CabinService, { nullable: false })
	@JoinColumn({ name: 'cabin_service_id', referencedColumnName: 'cabin_service_id' })
	cabin_service: CabinService;

	/**
	 * Service type (denormalized for quick access)
	 * Examples: 'meal', 'wifi', 'entertainment', etc.
	 */
	@Column({ type: 'varchar', length: 50, nullable: false })
	service_type: string;

	/**
	 * Service name (denormalized for quick access)
	 */
	@Column({ type: 'nvarchar', length: 200, nullable: false })
	service_name: string;

	/**
	 * Price at time of booking (in VND)
	 * NULL if service was included
	 */
	@Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
	price: number | null;

	/**
	 * Whether service was included (true) or purchased (false)
	 */
	@Column({ type: 'bit', nullable: false, default: 0 })
	is_included: boolean;

	@CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
	created_at: Date;
}

