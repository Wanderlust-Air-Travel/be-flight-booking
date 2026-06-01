import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: 'CabinClasses', schema: 'dbo' })
export class CabinClass {
	@PrimaryColumn({ type: 'varchar', length: 5 })
	cabin_class_code: string;

	@Column({ type: 'nvarchar', length: 50, nullable: false })
	name: string;
}


