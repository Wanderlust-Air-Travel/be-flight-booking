import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Payment } from './payment.entity';

@Entity({ name: 'PaymentMethods', schema: 'dbo' })
export class PaymentMethod {
    @PrimaryColumn({ type: 'varchar', length: 20 })
    payment_method_code: string;

    @Column({ type: 'nvarchar', length: 50, nullable: false })
    name: string;

    @Column({ type: 'bit', default: true })
    is_active: boolean;

    @OneToMany(
        () => Payment,
        (p) => p.payment_method
    )
    payments: Payment[];
}
