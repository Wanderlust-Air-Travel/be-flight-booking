import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, RelationId } from "typeorm";
import { User } from "src/shared/entities/user/user.entity";

@Entity({ name: 'Passengers', schema: 'dbo' })
export class Passenger {
	@PrimaryColumn('uniqueidentifier')
	passenger_id: string;

	// N Passengers -> 1 User (nullable theo schema mới)
	@ManyToOne(() => User, (u) => u.passengers, { nullable: true })
	@JoinColumn({ name: 'user_id', referencedColumnName: 'user_id'})
	user: User | null;

	// Nếu cần đọc user_id dạng primitive:
	@RelationId((p: Passenger) => p.user)
	user_id: string | null;

	@Column({ type: 'nvarchar', nullable: false, length: 100 })
	fullname: string;

	@Column({ nullable: false, type: 'date' })
	dob: Date;

	@Column({ type: 'nvarchar', nullable: false, length: 10 })
	gender: string;

	@Column({ type: 'varchar', nullable: true, length: 50 })
	document_number: string | null; // Nullable for CHD and INF passengers

	@Column({ type: 'varchar', nullable: true, length: 50 })
	loyalty_number: string | null;

	@CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
	created_at: Date;
}