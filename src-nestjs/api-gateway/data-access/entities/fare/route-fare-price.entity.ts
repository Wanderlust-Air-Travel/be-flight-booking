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
import { Route } from '../route/route.entity';
import { FareClass } from './fare-class.entity';

/**
 * RouteFarePrice Entity
 * Stores fare prices for each route and fare class combination
 * Supports dynamic pricing and price changes over time
 */
@Entity({ name: 'RouteFarePrices', schema: 'dbo' })
@Index('IDX_RouteFarePrice_Route_FareClass', ['route_id', 'fare_class_code'])
@Index('IDX_RouteFarePrice_EffectiveDates', ['effective_from', 'effective_to'])
export class RouteFarePrice {
    @PrimaryColumn('uniqueidentifier')
    route_fare_price_id: string;

    @ManyToOne(() => Route, { nullable: false })
    @JoinColumn({ name: 'route_id', referencedColumnName: 'route_id' })
    route: Route;

    @Column('uniqueidentifier', { nullable: false })
    route_id: string;

    @ManyToOne(() => FareClass, { nullable: false })
    @JoinColumn({ name: 'fare_class_code', referencedColumnName: 'fare_class_code' })
    fare_class: FareClass;

    @Column({ type: 'varchar', length: 5, nullable: false })
    fare_class_code: string;

    /**
     * Base fare price (adult, one-way)
     * Stored in VND (Vietnamese Dong)
     */
    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
    base_price: number;

    /**
     * Tax rate (as decimal, e.g., 0.1 for 10%)
     * Applied to base_price
     */
    @Column({ type: 'decimal', precision: 5, scale: 4, nullable: false, default: 0.1 })
    tax_rate: number;

    /**
     * Fee rate (as decimal, e.g., 0.05 for 5%)
     * Applied to base_price
     */
    @Column({ type: 'decimal', precision: 5, scale: 4, nullable: false, default: 0.05 })
    fee_rate: number;

    /**
     * Effective from date - price is valid from this date
     */
    @Column({ type: 'date', nullable: false })
    effective_from: Date;

    /**
     * Effective to date - price is valid until this date (inclusive)
     * NULL means price is valid indefinitely
     */
    @Column({ type: 'date', nullable: true })
    effective_to: Date | null;

    /**
     * Whether this price is currently active
     * Allows soft deactivation without deleting
     */
    @Column({ type: 'bit', nullable: false, default: () => '1' })
    is_active: boolean;

    /**
     * Priority - higher priority prices take precedence when multiple prices exist
     * Useful for special promotions or seasonal pricing
     */
    @Column({ type: 'int', nullable: false, default: 0 })
    priority: number;

    /**
     * Notes or description for this price (e.g., "Promotional price", "Peak season")
     */
    @Column({ type: 'nvarchar', length: 500, nullable: true })
    notes: string | null;

    @CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
    created_at: Date;

    @UpdateDateColumn({ type: 'datetime2', nullable: true })
    updated_at: Date | null;
}
