import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, RelationId, Unique, UpdateDateColumn } from "typeorm";
import { FlightSchedule } from "./flight-schedule.entity";
import { Aircraft } from "../aircraft/aircraft.entity";

@Entity({ name: 'FlightInstances', schema: 'dbo' })
@Unique('UQ_FlightInstances_FlightNumber_Date', ['flight_number', 'flight_date'])
export class FlightInstance {
	@PrimaryColumn('uniqueidentifier')
	flight_instance_id: string;

	@ManyToOne(() => FlightSchedule, { nullable: false })
	@JoinColumn({ name: 'flight_schedule_id', referencedColumnName: 'flight_schedule_id' })
	flight_schedule: FlightSchedule;

	@RelationId((f: FlightInstance) => f.flight_schedule)
	flight_schedule_id: string;

	@Column({ type: 'date', nullable: false })
	flight_date: Date;

	@Column({ type: 'varchar', length: 10, nullable: false })
	flight_number: string;

	@ManyToOne(() => Aircraft, { nullable: true })
	@JoinColumn({ name: 'aircraft_id', referencedColumnName: 'aircraft_id' })
	aircraft: Aircraft | null;

	@RelationId((f: FlightInstance) => f.aircraft)
	aircraft_id: string | null;

	@Column({ type: 'datetime2', nullable: false })
	departure_datetime_local: Date;

	@Column({ type: 'datetime2', nullable: false })
	arrival_datetime_local: Date;

	@Column({ type: 'varchar', length: 20, nullable: false, default: () => "'scheduled'" })
	status: string;

	@CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
	created_at: Date;

	@UpdateDateColumn({ type: 'datetime2', nullable: true })
	updated_at: Date | null;
}


