import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { FlightInstance } from "./flight-instance.entity";
import { SeatConfiguration } from "src/domain/seat/entity/seat-configuration.entity";

@Entity({ name: 'FlightSeats', schema: 'dbo' })
// Unique constraint UQ_FlightSeats_Instance_SeatNumber đã được tạo trong DB schema
// Không cần khai báo ở đây vì TypeORM sẽ gặp lỗi với @RelationId properties
export class FlightSeat {
	@PrimaryGeneratedColumn('uuid')
	flight_seat_id: string;

	@ManyToOne(() => FlightInstance, { nullable: false })
	@JoinColumn({ name: 'flight_instance_id', referencedColumnName: 'flight_instance_id' })
	flight_instance: FlightInstance;

	@RelationId((s: FlightSeat) => s.flight_instance)
	flight_instance_id: string;

	@ManyToOne(() => SeatConfiguration, { nullable: false })
	@JoinColumn({ name: 'seat_config_id', referencedColumnName: 'seat_config_id' })
	seat_config: SeatConfiguration;

	@RelationId((s: FlightSeat) => s.seat_config)
	seat_config_id: string;

	@Column({ type: 'varchar', length: 10, nullable: false })
	seat_number: string;

	@Column({ type: 'bit', nullable: false, default: () => '1' })
	is_available: boolean;
}


