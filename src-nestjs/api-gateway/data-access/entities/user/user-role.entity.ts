import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Role } from '../role/role.entity';
import { User } from './user.entity';

/**
 * UserRole Entity (Join Table)
 * Many-to-Many relationship between Users and Roles
 */
@Entity({ name: 'UserRoles', schema: 'dbo' })
export class UserRole {
    @PrimaryColumn('uniqueidentifier')
    user_id: string;

    @PrimaryColumn({ type: 'varchar', length: 50 })
    role_code: string;

    @ManyToOne(
        () => User,
        (user) => user.userRoles,
        { onDelete: 'CASCADE' }
    )
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    user: User;

    @ManyToOne(() => Role, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role_code', referencedColumnName: 'role_code' })
    role: Role;
}
