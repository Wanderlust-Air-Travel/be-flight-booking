import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, Unique } from "typeorm";
import { Airport } from "src/domain/airport/entity/airport.entity";

@Entity({ name: 'Routes', schema: 'dbo' })
@Unique('UQ_Routes_Origin_Destination', ['origin_airport_id', 'destination_airport_id'])
export class Route {
	@PrimaryGeneratedColumn('uuid')
	route_id: string;

	@ManyToOne(() => Airport, { nullable: false })
	@JoinColumn({ name: 'origin_airport_id', referencedColumnName: 'airport_id' })
	origin_airport: Airport;

	@RelationId((r: Route) => r.origin_airport)
	origin_airport_id: string;

	@ManyToOne(() => Airport, { nullable: false })
	@JoinColumn({ name: 'destination_airport_id', referencedColumnName: 'airport_id' })
	destination_airport: Airport;

	@RelationId((r: Route) => r.destination_airport)
	destination_airport_id: string;

	@Column({ type: 'int', nullable: true })
	distance_km: number | null;

	@Column({ type: 'bit', nullable: false, default: () => '1' })
	is_domestic: boolean;

	@CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
	created_at: Date;
}


