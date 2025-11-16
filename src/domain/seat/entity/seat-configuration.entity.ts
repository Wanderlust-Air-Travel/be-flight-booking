import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId, Unique } from "typeorm";
import { AircraftType } from "src/domain/aircraft/entity/aircraft-type.entity";
import { CabinClass } from "src/domain/cabin/entity/cabin-class.entity";

@Entity({ name: 'SeatConfigurations', schema: 'dbo' })
@Unique('UQ_SeatConfigurations_AircraftType_SeatNumber', ['aircraft_type_id', 'seat_number'])
export class SeatConfiguration {
	@PrimaryGeneratedColumn('uuid')
	seat_config_id: string;

	@ManyToOne(() => AircraftType, { nullable: false })
	@JoinColumn({ name: 'aircraft_type_id', referencedColumnName: 'aircraft_type_id' })
	aircraft_type: AircraftType;

	@RelationId((s: SeatConfiguration) => s.aircraft_type)
	aircraft_type_id: string;

	@Column({ type: 'varchar', length: 10, nullable: false })
	seat_number: string;

	@ManyToOne(() => CabinClass, { nullable: false })
	@JoinColumn({ name: 'cabin_class_code', referencedColumnName: 'cabin_class_code' })
	cabin_class: CabinClass;

	@Column({ type: 'varchar', length: 20, nullable: true })
	seat_type: string | null;

	@Column({ type: 'bit', nullable: false, default: () => '0' })
	is_exit_row: boolean;
}


