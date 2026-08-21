import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Currency } from '../currency/currency.entity';
import { Payment } from '../payment/payment.entity';
import { Ticket } from '../ticket/ticket.entity';
import { User } from '../user/user.entity';
import { BookingPassenger } from './booking-passenger.entity';
import { BookingSegment } from './booking-segment.entity';

@Entity({ name: 'Bookings', schema: 'dbo' })
export class Booking {
    @PrimaryColumn('uniqueidentifier')
    booking_id: string;

    @Index({ unique: true })
    @Column({ type: 'varchar', length: 10, nullable: false, unique: true })
    pnr_code: string;

    @ManyToOne(
        () => User,
        (u) => u.bookings,
        { nullable: true }
    )
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    user: User | null;

    @ManyToOne(
        () => Currency,
        (c) => c.bookings,
        { nullable: false }
    )
    @JoinColumn({ name: 'currency_code', referencedColumnName: 'currency_code' })
    currency: Currency;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
    total_amount: number;

    @Column({ type: 'varchar', length: 20, nullable: false, default: 'pending' })
    status: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    channel: string | null;

    @Column({ type: 'nvarchar', length: 100, nullable: false })
    contact_fullname: string;

    @Column({ type: 'varchar', length: 100, nullable: false })
    contact_email: string;

    @Column({ type: 'varchar', length: 20, nullable: false })
    contact_phone: string;

    @CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
    created_at: Date;

    @UpdateDateColumn({ type: 'datetime2', nullable: true })
    updated_at: Date | null;

    @OneToMany(
        () => BookingPassenger,
        (bp) => bp.booking
    )
    booking_passengers: BookingPassenger[];

    @OneToMany(
        () => BookingSegment,
        (bs) => bs.booking
    )
    booking_segments: BookingSegment[];

    @OneToMany(
        () => Ticket,
        (t) => t.booking
    )
    tickets: Ticket[];

    @OneToMany(
        () => Payment,
        (p) => p.booking
    )
    payments: Payment[];
}
