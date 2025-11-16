import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'AircraftTypes', schema: 'dbo' })
export class AircraftType {
	@PrimaryGeneratedColumn('uuid')
	aircraft_type_id: string;

	@Column({ type: 'varchar', length: 20, unique: true, nullable: false })
	code: string;

	@Column({ type: 'nvarchar', length: 100, nullable: false })
	manufacturer: string;

	@Column({ type: 'nvarchar', length: 100, nullable: false })
	model: string;

	@Column({ type: 'int', nullable: false })
	total_seats: number;
}


