import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateBookingSegmentServicesTable1735000000000 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		// Create BookingSegmentServices table
		await queryRunner.createTable(
			new Table({
				name: 'BookingSegmentServices',
				schema: 'dbo',
				columns: [
					{
						name: 'booking_segment_service_id',
						type: 'uniqueidentifier',
						isPrimary: true,
						default: 'NEWID()',
					},
					{
						name: 'booking_segment_id',
						type: 'uniqueidentifier',
						isNullable: false,
					},
					{
						name: 'cabin_service_id',
						type: 'uniqueidentifier',
						isNullable: false,
					},
					{
						name: 'service_type',
						type: 'varchar',
						length: '50',
						isNullable: false,
					},
					{
						name: 'service_name',
						type: 'nvarchar',
						length: '200',
						isNullable: false,
					},
					{
						name: 'price',
						type: 'decimal',
						precision: 12,
						scale: 2,
						isNullable: true,
					},
					{
						name: 'is_included',
						type: 'bit',
						isNullable: false,
						default: 0,
					},
					{
						name: 'created_at',
						type: 'datetime2',
						isNullable: false,
						default: 'SYSDATETIME()',
					},
				],
			}),
			true,
		);

		// Create indexes
		await queryRunner.createIndex(
			'dbo.BookingSegmentServices',
			new TableIndex({
				name: 'IDX_BookingSegmentService_BookingSegment',
				columnNames: ['booking_segment_id'],
			}),
		);

		await queryRunner.createIndex(
			'dbo.BookingSegmentServices',
			new TableIndex({
				name: 'IDX_BookingSegmentService_CabinService',
				columnNames: ['cabin_service_id'],
			}),
		);

		// Create foreign keys
		await queryRunner.createForeignKey(
			'dbo.BookingSegmentServices',
			new TableForeignKey({
				name: 'FK_BookingSegmentServices_BookingSegments',
				columnNames: ['booking_segment_id'],
				referencedTableName: 'BookingSegments',
				referencedSchema: 'dbo',
				referencedColumnNames: ['booking_segment_id'],
				onDelete: 'CASCADE',
			}),
		);

		await queryRunner.createForeignKey(
			'dbo.BookingSegmentServices',
			new TableForeignKey({
				name: 'FK_BookingSegmentServices_CabinServices',
				columnNames: ['cabin_service_id'],
				referencedTableName: 'CabinServices',
				referencedSchema: 'dbo',
				referencedColumnNames: ['cabin_service_id'],
				onDelete: 'NO ACTION',
			}),
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop foreign keys
		await queryRunner.dropForeignKey('dbo.BookingSegmentServices', 'FK_BookingSegmentServices_CabinServices');
		await queryRunner.dropForeignKey('dbo.BookingSegmentServices', 'FK_BookingSegmentServices_BookingSegments');

		// Drop indexes
		await queryRunner.dropIndex('dbo.BookingSegmentServices', 'IDX_BookingSegmentService_CabinService');
		await queryRunner.dropIndex('dbo.BookingSegmentServices', 'IDX_BookingSegmentService_BookingSegment');

		// Drop table
		await queryRunner.dropTable('dbo.BookingSegmentServices', true);
	}
}

