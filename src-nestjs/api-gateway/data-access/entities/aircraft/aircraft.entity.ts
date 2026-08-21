import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, RelationId } from 'typeorm';
import { AircraftType } from './aircraft-type.entity';

@Entity({ name: 'Aircrafts', schema: 'dbo' })
export class Aircraft {
    @PrimaryColumn('uniqueidentifier')
    aircraft_id: string;

    @ManyToOne(() => AircraftType, { nullable: false })
    @JoinColumn({ name: 'aircraft_type_id', referencedColumnName: 'aircraft_type_id' })
    aircraft_type: AircraftType;

    @RelationId((a: Aircraft) => a.aircraft_type)
    aircraft_type_id: string;

    @Column({ type: 'varchar', length: 20, nullable: false, unique: true })
    registration: string;

    @Column({ type: 'bit', nullable: false, default: () => '1' })
    in_service: boolean;
}
