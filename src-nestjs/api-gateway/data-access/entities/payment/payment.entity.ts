import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Booking } from '../booking/booking.entity';
import { Currency } from '../currency/currency.entity';
import { PaymentMethod } from './payment-method.entity';

@Entity({ name: 'Payments', schema: 'dbo' })
export class Payment {
    @PrimaryColumn('uniqueidentifier')
    payment_id: string;

    @ManyToOne(
        () => Booking,
        (b) => b.payments,
        { nullable: false }
    )
    @JoinColumn({ name: 'booking_id', referencedColumnName: 'booking_id' })
    booking: Booking;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
    amount: number;

    @ManyToOne(
        () => Currency,
        (c) => c.payments,
        { nullable: false }
    )
    @JoinColumn({ name: 'currency_code', referencedColumnName: 'currency_code' })
    currency: Currency;

    @ManyToOne(
        () => PaymentMethod,
        (pm) => pm.payments,
        { nullable: false }
    )
    @JoinColumn({ name: 'payment_method_code', referencedColumnName: 'payment_method_code' })
    payment_method: PaymentMethod;

    @Column({ type: 'varchar', length: 20, nullable: false })
    status: string; // success/failed/pending

    @Column({ type: 'datetime2', nullable: true })
    paid_at: Date | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    transaction_ref: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    idempotency_key: string | null;

    @Column({ type: 'datetime2', nullable: true })
    expires_at: Date | null;

    @CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
    created_at: Date;
}
