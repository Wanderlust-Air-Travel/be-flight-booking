import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { CabinClass } from "../cabin/cabin-class.entity";

@Entity({ name: 'FareClasses', schema: 'dbo' })
export class FareClass {
	@PrimaryColumn({ type: 'varchar', length: 5 })
	fare_class_code: string;

	@ManyToOne(() => CabinClass, { nullable: false })
	@JoinColumn({ name: 'cabin_class_code', referencedColumnName: 'cabin_class_code' })
	cabin_class: CabinClass;

	@Column({ type: 'nvarchar', length: 200, nullable: true })
	description: string | null;

	@Column({ type: 'nvarchar', length: 500, nullable: true })
	change_rule: string | null;

	@Column({ type: 'nvarchar', length: 500, nullable: true })
	refund_rule: string | null;
}


