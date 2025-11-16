import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { User } from "src/domain/user/entity/user.entity";

@Entity({ name: 'Passengers', schema: 'dbo' })
export class Passenger {
    @PrimaryGeneratedColumn('uuid')
    passenger_id: string;

     // N Passengers -> 1 User
     @ManyToOne(() => User, (u) => u.passengers, { onDelete: 'CASCADE', nullable: false})
     @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id'})
     user: User;

    // Nếu cần đọc user_id dạng primitive:
    @RelationId((p: Passenger) => p.user)
    user_id: string;

    @Column({ type: 'nvarchar', nullable: false, length: 100 })
    fullname: string;

    @Column({ nullable: false, type: 'date' })
    dob: Date;

    @Column({ type: 'nvarchar', nullable: false, length: 3 })
    gender: string;

    @Column({ type: 'varchar', nullable: false, length: 50 })
    document_number: string;

    @CreateDateColumn({ type: 'datetime2', nullable: false })
    created_at: Date;
}