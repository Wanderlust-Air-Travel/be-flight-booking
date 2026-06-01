import { Column, Entity, PrimaryGeneratedColumn, Index } from "typeorm";

@Entity({ name: 'FareDescriptionRules', schema: 'dbo' })
@Index(['fare_class_code_pattern', 'cabin_type', 'is_active'])
@Index(['cabin_type', 'display_order', 'is_active'])
export class FareDescriptionRule {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'varchar', length: 50, nullable: false })
	@Index()
	fare_class_code_pattern!: string; // Pattern để match: exact code (Y, J) hoặc contains pattern (SMX, FLX, SM, FLEX)

	@Column({ type: 'varchar', length: 20, nullable: false })
	@Index()
	cabin_type!: string; // 'economy' hoặc 'business'

	@Column({ type: 'nvarchar', length: 500, nullable: false })
	description_text!: string; // Nội dung mô tả

	@Column({ type: 'bit', nullable: false, default: true })
	status!: boolean; // true = included/available, false = not included/not available

	@Column({ type: 'int', nullable: false, default: 0 })
	display_order!: number; // Thứ tự hiển thị (0 = hiển thị đầu tiên)

	@Column({ type: 'bit', nullable: false, default: true })
	is_active!: boolean; // Có active không

	@Column({ type: 'bit', nullable: false, default: false })
	is_default!: boolean; // Có phải là rule mặc định (như "Hành lý xách tay: 7kg") không

	@Column({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
	created_at!: Date;

	@Column({ type: 'datetime2', nullable: true })
	updated_at!: Date | null;
}

