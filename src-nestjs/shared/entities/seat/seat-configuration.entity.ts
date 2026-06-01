import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, RelationId } from "typeorm";
import { AircraftType } from "../aircraft/aircraft-type.entity";
import { CabinClass } from "../cabin/cabin-class.entity";

@Entity({ name: 'SeatConfigurations', schema: 'dbo' })
// Unique constraint UQ_SeatConfigurations_AircraftType_SeatNumber đã được tạo trong DB schema
// Không cần khai báo ở đây vì TypeORM sẽ gặp lỗi với @RelationId properties
export class SeatConfiguration {
	@PrimaryColumn('uniqueidentifier')
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


