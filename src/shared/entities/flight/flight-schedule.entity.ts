import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, Unique } from "typeorm";
import { Route } from "src/shared/entities/route/route.entity";
import { AircraftType } from "src/shared/entities/aircraft/aircraft-type.entity";

@Entity({ name: 'FlightSchedules', schema: 'dbo' })
@Unique('UQ_FlightSchedules_FlightNumber_Period', ['flight_number', 'effective_from', 'effective_to'])
export class FlightSchedule {
	@PrimaryGeneratedColumn('uuid')
	flight_schedule_id: string;

	@Column({ type: 'varchar', length: 10, nullable: false })
	flight_number: string;

	@ManyToOne(() => Route, { nullable: false })
	@JoinColumn({ name: 'route_id', referencedColumnName: 'route_id' })
	route: Route;

	@RelationId((s: FlightSchedule) => s.route)
	route_id: string;

	@ManyToOne(() => AircraftType, { nullable: false })
	@JoinColumn({ name: 'aircraft_type_id', referencedColumnName: 'aircraft_type_id' })
	aircraft_type: AircraftType;

	@RelationId((s: FlightSchedule) => s.aircraft_type)
	aircraft_type_id: string;

	@Column({ type: 'time', nullable: false })
	departure_time_local: string;

	@Column({ type: 'time', nullable: false })
	arrival_time_local: string;

	@Column({ type: 'char', length: 7, nullable: false })
	operating_days: string;

	@Column({ type: 'date', nullable: false })
	effective_from: Date;

	@Column({ type: 'date', nullable: false })
	effective_to: Date;

	@Column({ type: 'varchar', length: 20, nullable: false, default: () => "'active'" })
	status: string;
}


