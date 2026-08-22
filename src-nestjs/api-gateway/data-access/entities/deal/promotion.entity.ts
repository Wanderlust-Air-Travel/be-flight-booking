import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'Promotions', schema: 'dbo' })
export class Promotion {
    @PrimaryColumn('uniqueidentifier')
    promotion_id: string;

    @Column({ type: 'varchar', length: 50, nullable: false, unique: true })
    code: string;

    @Column({ type: 'nvarchar', length: 1000, nullable: true })
    description: string | null;

    @Column({ type: 'datetime2', nullable: false })
    valid_until: Date;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
    min_purchase_amount: number;

    @Column({ type: 'varchar', length: 3, nullable: false, default: 'VND' })
    currency: string;

    @Column({ type: 'int', nullable: false })
    discount_pct: number;

    @Column({ type: 'bit', nullable: false, default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'datetime2', default: () => 'SYSDATETIME()' })
    created_at: Date;

    @UpdateDateColumn({ type: 'datetime2', nullable: true })
    updated_at: Date | null;
}
