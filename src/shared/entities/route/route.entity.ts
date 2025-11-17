import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, RelationId } from "typeorm";
import { Airport } from "src/shared/entities/airport/airport.entity";

@Entity({ name: 'Routes', schema: 'dbo' })
// Unique constraint UQ_Routes_Origin_Destination đã được tạo trong DB schema
// Không cần khai báo ở đây vì TypeORM sẽ gặp lỗi với @RelationId properties
export class Route {
	@PrimaryColumn('uniqueidentifier')
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


