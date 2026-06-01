import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: 'Airports', schema: 'dbo' })
export class Airport {
	@PrimaryColumn('uniqueidentifier')
	airport_id: string;

	@Column({ type: 'char', length: 3, unique: true, nullable: false })
	iata_code: string;

	@Column({ type: 'char', length: 4, nullable: true })
	icao_code: string | null;

	@Column({ type: 'nvarchar', length: 150, nullable: false })
	name: string;

	@Column({ type: 'nvarchar', length: 100, nullable: false })
	city: string;

	@Column({ type: 'nvarchar', length: 100, nullable: false })
	country: string;

	@Column({ type: 'varchar', length: 50, nullable: false })
	timezone: string;
}


