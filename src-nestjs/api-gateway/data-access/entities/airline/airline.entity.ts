import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'Airlines', schema: 'dbo' })
export class Airline {
    @PrimaryColumn('uniqueidentifier')
    airline_id: string;

    @Column({ type: 'char', length: 2, unique: true, nullable: false })
    iata_code: string;

    @Column({ type: 'char', length: 3, unique: true, nullable: true })
    icao_code: string | null;

    @Column({ type: 'nvarchar', length: 150, nullable: false })
    name: string;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    callsign: string | null;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    country: string | null;
}
