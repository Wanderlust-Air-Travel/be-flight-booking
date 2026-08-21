import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
    UpdateDateColumn,
} from 'typeorm';
import { FareClass } from '../fare/fare-class.entity';
import { CabinClass } from './cabin-class.entity';

/**
 * CabinService Entity
 * Stores services and amenities included in each cabin class or fare class
 * Examples: meals, entertainment, WiFi, priority boarding, lounge access, etc.
 */
@Entity({ name: 'CabinServices', schema: 'dbo' })
@Index('IDX_CabinService_CabinClass', ['cabin_class_code'])
@Index('IDX_CabinService_FareClass', ['fare_class_code'])
export class CabinService {
    @PrimaryColumn('uniqueidentifier')
    cabin_service_id: string;

    @ManyToOne(() => CabinClass, { nullable: true })
    @JoinColumn({ name: 'cabin_class_code', referencedColumnName: 'cabin_class_code' })
    cabin_class: CabinClass | null;

    /**
     * Cabin class code (nullable if service is fare-class specific)
     * If null, service applies to all cabin classes
     */
    @Column({ type: 'varchar', length: 5, nullable: true })
    cabin_class_code: string | null;

    @ManyToOne(() => FareClass, { nullable: true })
    @JoinColumn({ name: 'fare_class_code', referencedColumnName: 'fare_class_code' })
    fare_class: FareClass | null;

    /**
     * Fare class code (nullable if service is cabin-class specific)
     * If null, service applies to all fare classes in the cabin
     */
    @Column({ type: 'varchar', length: 5, nullable: true })
    fare_class_code: string | null;

    /**
     * Service type/category
     * Examples: 'meal', 'entertainment', 'wifi', 'priority_boarding', 'lounge_access', 'seat_selection', etc.
     */
    @Column({ type: 'varchar', length: 50, nullable: false })
    service_type: string;

    /**
     * Service name/description
     * Examples: 'Hot Meal', 'In-flight Entertainment', 'WiFi Access', etc.
     */
    @Column({ type: 'nvarchar', length: 200, nullable: false })
    service_name: string;

    /**
     * Detailed description of the service
     */
    @Column({ type: 'nvarchar', length: 1000, nullable: true })
    description: string | null;

    /**
     * Whether this service is included (true) or available for purchase (false)
     */
    @Column({ type: 'bit', nullable: false, default: () => '1' })
    is_included: boolean;

    /**
     * Price if service is not included (in VND)
     * NULL if service is included
     */
    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    price: number | null;

    /**
     * Whether this service is currently available
     */
    @Column({ type: 'bit', nullable: false, default: () => '1' })
    is_active: boolean;

    /**
     * Display order for UI
     */
    @Column({ type: 'int', nullable: false, default: 0 })
    display_order: number;

    /**
     * Icon or image URL for the service
     */
    @Column({ type: 'nvarchar', length: 500, nullable: true })
    icon_url: string | null;

    @CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
    created_at: Date;

    @UpdateDateColumn({ type: 'datetime2', nullable: true })
    updated_at: Date | null;
}
