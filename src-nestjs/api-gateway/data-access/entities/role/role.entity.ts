import { Column, Entity, ManyToMany, PrimaryColumn } from 'typeorm';
import { User } from '../user/user.entity';

/**
 * Role Entity
 * Represents user roles in the system (e.g., ADMIN, FARE_MANAGER, FLIGHT_MANAGER, CUSTOMER)
 */
@Entity({ name: 'Roles', schema: 'dbo' })
export class Role {
    @PrimaryColumn({ type: 'varchar', length: 50 })
    role_code: string;

    @Column({ type: 'nvarchar', length: 100, nullable: false })
    name: string;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    description: string | null;

    @Column({ type: 'bit', nullable: false, default: () => '1' })
    is_active: boolean;

    @ManyToMany(
        () => User,
        (user) => user.roles
    )
    users: User[];
}
