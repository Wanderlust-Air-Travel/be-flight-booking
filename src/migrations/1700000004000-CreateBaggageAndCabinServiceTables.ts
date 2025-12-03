import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateBaggageAndCabinServiceTables1700000004000 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		// Create BaggageAllowances table
		await queryRunner.createTable(
			new Table({
				name: 'BaggageAllowances',
				schema: 'dbo',
				columns: [
					{
						name: 'baggage_allowance_id',
						type: 'uniqueidentifier',
						isPrimary: true,
						default: 'NEWID()',
					},
					{
						name: 'fare_class_code',
						type: 'varchar',
						length: '5',
						isNullable: false,
					},
					{
						name: 'checked_baggage_kg',
						type: 'int',
						isNullable: true,
					},
					{
						name: 'checked_baggage_pieces',
						type: 'int',
						isNullable: true,
					},
					{
						name: 'carry_on_kg',
						type: 'int',
						isNullable: false,
						default: 7,
					},
					{
						name: 'carry_on_pieces',
						type: 'int',
						isNullable: false,
						default: 1,
					},
					{
						name: 'carry_on_dimensions',
						type: 'nvarchar',
						length: '50',
						isNullable: true,
					},
					{
						name: 'is_domestic',
						type: 'bit',
						isNullable: false,
						default: 1,
					},
					{
						name: 'is_international',
						type: 'bit',
						isNullable: false,
						default: 1,
					},
					{
						name: 'notes',
						type: 'nvarchar',
						length: '500',
						isNullable: true,
					},
					{
						name: 'created_at',
						type: 'datetime2',
						isNullable: false,
						default: 'SYSDATETIME()',
					},
					{
						name: 'updated_at',
						type: 'datetime2',
						isNullable: true,
					},
				],
			}),
			true,
		);

		// Create CabinServices table
		await queryRunner.createTable(
			new Table({
				name: 'CabinServices',
				schema: 'dbo',
				columns: [
					{
						name: 'cabin_service_id',
						type: 'uniqueidentifier',
						isPrimary: true,
						default: 'NEWID()',
					},
					{
						name: 'cabin_class_code',
						type: 'varchar',
						length: '5',
						isNullable: true,
					},
					{
						name: 'fare_class_code',
						type: 'varchar',
						length: '5',
						isNullable: true,
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
						name: 'description',
						type: 'nvarchar',
						length: '1000',
						isNullable: true,
					},
					{
						name: 'is_included',
						type: 'bit',
						isNullable: false,
						default: 1,
					},
					{
						name: 'price',
						type: 'decimal',
						precision: 12,
						scale: 2,
						isNullable: true,
					},
					{
						name: 'is_active',
						type: 'bit',
						isNullable: false,
						default: 1,
					},
					{
						name: 'display_order',
						type: 'int',
						isNullable: false,
						default: 0,
					},
					{
						name: 'icon_url',
						type: 'nvarchar',
						length: '500',
						isNullable: true,
					},
					{
						name: 'created_at',
						type: 'datetime2',
						isNullable: false,
						default: 'SYSDATETIME()',
					},
					{
						name: 'updated_at',
						type: 'datetime2',
						isNullable: true,
					},
				],
			}),
			true,
		);

		// Create indexes for BaggageAllowances
		await queryRunner.createIndex(
			'dbo.BaggageAllowances',
			new TableIndex({
				name: 'IDX_BaggageAllowance_FareClass',
				columnNames: ['fare_class_code'],
			}),
		);

		// Create indexes for CabinServices
		await queryRunner.createIndex(
			'dbo.CabinServices',
			new TableIndex({
				name: 'IDX_CabinService_CabinClass',
				columnNames: ['cabin_class_code'],
			}),
		);

		await queryRunner.createIndex(
			'dbo.CabinServices',
			new TableIndex({
				name: 'IDX_CabinService_FareClass',
				columnNames: ['fare_class_code'],
			}),
		);

		await queryRunner.createIndex(
			'dbo.CabinServices',
			new TableIndex({
				name: 'IDX_CabinService_Active',
				columnNames: ['is_active', 'cabin_class_code', 'fare_class_code'],
			}),
		);

		// Create foreign keys for BaggageAllowances
		await queryRunner.createForeignKey(
			'dbo.BaggageAllowances',
			new TableForeignKey({
				columnNames: ['fare_class_code'],
				referencedTableName: 'FareClasses',
				referencedSchema: 'dbo',
				referencedColumnNames: ['fare_class_code'],
				onDelete: 'CASCADE',
				onUpdate: 'CASCADE',
			}),
		);

		// Create foreign keys for CabinServices
		await queryRunner.createForeignKey(
			'dbo.CabinServices',
			new TableForeignKey({
				columnNames: ['cabin_class_code'],
				referencedTableName: 'CabinClasses',
				referencedSchema: 'dbo',
				referencedColumnNames: ['cabin_class_code'],
				onDelete: 'CASCADE',
				onUpdate: 'CASCADE',
			}),
		);

		await queryRunner.createForeignKey(
			'dbo.CabinServices',
			new TableForeignKey({
				columnNames: ['fare_class_code'],
				referencedTableName: 'FareClasses',
				referencedSchema: 'dbo',
				referencedColumnNames: ['fare_class_code'],
				onDelete: 'CASCADE',
				onUpdate: 'CASCADE',
			}),
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropTable('dbo.CabinServices', true);
		await queryRunner.dropTable('dbo.BaggageAllowances', true);
	}
}

