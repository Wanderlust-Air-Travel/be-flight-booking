import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'Deals', schema: 'dbo' })
export class Deal {
    @PrimaryColumn('uniqueidentifier')
    deal_id: string;

    @Column({ type: 'nvarchar', length: 500, nullable: false })
    title: string;

    @Column({ type: 'nvarchar', length: 1000, nullable: true })
    description: string | null;

    @Column({ type: 'datetime2', nullable: false })
    valid_from: Date;

    @Column({ type: 'datetime2', nullable: false })
    valid_until: Date;

    @Column({ type: 'int', nullable: false })
    discount_pct: number;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    destinations: string | null;

    @Column({ type: 'bit', nullable: false, default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'datetime2', default: () => 'SYSDATETIME()' })
    created_at: Date;

    @UpdateDateColumn({ type: 'datetime2', nullable: true })
    updated_at: Date | null;
}
