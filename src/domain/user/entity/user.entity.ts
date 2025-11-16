import { Passenger } from "src/domain/passenger/entity/passenger.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class User {
    @PrimaryGeneratedColumn('uuid')
    user_id: string;

    @Column({ nullable: false, length: 100 })
    fullname: string;

    @Column({ unique: true, nullable: false, length: 100 })
    email: string;

    @Column({ nullable: false, length: 255 })
    password_hash: string;

    @Column({ nullable: false, length: 20 })
    phone: string;

    @CreateDateColumn({ nullable: false, type: 'datetime2', default: () => 'SYSDATETIME()' })
    created_at: Date;

    @UpdateDateColumn({ nullable: true, type: 'datetime2'})
    updated_at: Date | null;

    @Column({type: 'varchar', nullable: true})
    refresh_token: string | null;

    @Column({type: 'datetime2', nullable: true})
    refresh_token_expires_at: Date | null;

    @Column({type: 'varchar', nullable: true})
    forgot_password_token: string | null;

    @Column({type: 'datetime2', nullable: true})
    forgot_password_token_expires_at: Date | null;

    // 1 User -> N Passengers
    @OneToMany(() => Passenger, (p) => p.user, {cascade: false})
    passengers: Passenger[];
}