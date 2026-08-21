import {
    type MigrationInterface,
    type QueryRunner,
    Table,
    TableForeignKey,
    TableIndex,
} from 'typeorm';

export class CreateRouteFarePriceTable1700000003000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'RouteFarePrices',
                schema: 'dbo',
                columns: [
                    {
                        name: 'route_fare_price_id',
                        type: 'uniqueidentifier',
                        isPrimary: true,
                        default: 'NEWID()',
                    },
                    {
                        name: 'route_id',
                        type: 'uniqueidentifier',
                        isNullable: false,
                    },
                    {
                        name: 'fare_class_code',
                        type: 'varchar',
                        length: '5',
                        isNullable: false,
                    },
                    {
                        name: 'base_price',
                        type: 'decimal',
                        precision: 12,
                        scale: 2,
                        isNullable: false,
                    },
                    {
                        name: 'tax_rate',
                        type: 'decimal',
                        precision: 5,
                        scale: 4,
                        isNullable: false,
                        default: 0.1,
                    },
                    {
                        name: 'fee_rate',
                        type: 'decimal',
                        precision: 5,
                        scale: 4,
                        isNullable: false,
                        default: 0.05,
                    },
                    {
                        name: 'effective_from',
                        type: 'date',
                        isNullable: false,
                    },
                    {
                        name: 'effective_to',
                        type: 'date',
                        isNullable: true,
                    },
                    {
                        name: 'is_active',
                        type: 'bit',
                        isNullable: false,
                        default: 1,
                    },
                    {
                        name: 'priority',
                        type: 'int',
                        isNullable: false,
                        default: 0,
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
            true
        );

        // Create indexes
        await queryRunner.createIndex(
            'dbo.RouteFarePrices',
            new TableIndex({
                name: 'IDX_RouteFarePrice_Route_FareClass',
                columnNames: ['route_id', 'fare_class_code'],
            })
        );

        await queryRunner.createIndex(
            'dbo.RouteFarePrices',
            new TableIndex({
                name: 'IDX_RouteFarePrice_EffectiveDates',
                columnNames: ['effective_from', 'effective_to'],
            })
        );

        await queryRunner.createIndex(
            'dbo.RouteFarePrices',
            new TableIndex({
                name: 'IDX_RouteFarePrice_Active',
                columnNames: ['is_active', 'effective_from', 'effective_to'],
            })
        );

        // Create foreign keys
        await queryRunner.createForeignKey(
            'dbo.RouteFarePrices',
            new TableForeignKey({
                columnNames: ['route_id'],
                referencedTableName: 'Routes',
                referencedSchema: 'dbo',
                referencedColumnNames: ['route_id'],
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            })
        );

        await queryRunner.createForeignKey(
            'dbo.RouteFarePrices',
            new TableForeignKey({
                columnNames: ['fare_class_code'],
                referencedTableName: 'FareClasses',
                referencedSchema: 'dbo',
                referencedColumnNames: ['fare_class_code'],
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            })
        );

        // Create unique constraint: one active price per route + fare class + date range
        await queryRunner.query(`
			CREATE UNIQUE INDEX UQ_RouteFarePrice_Active_Route_FareClass_DateRange
			ON dbo.RouteFarePrices(route_id, fare_class_code, effective_from, effective_to)
			WHERE is_active = 1 AND effective_to IS NOT NULL;
		`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('dbo.RouteFarePrices', true);
    }
}
