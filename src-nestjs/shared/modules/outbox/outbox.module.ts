import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from '../../infrastructure/persistence/typeorm/entities/outbox-event.entity';
import { TypeOrmOutboxRepository } from '../../infrastructure/persistence/typeorm/typeorm-outbox-repository';
import { TypeOrmOutboxWriter } from '../../infrastructure/persistence/typeorm/typeorm-outbox-writer';

/**
 * OutboxModule — Wires the transactional outbox for DDD domain events.
 *
 * Exports:
 *  - IOutboxWriter (interface token) → TypeOrmOutboxWriter
 *  - IOutboxRepository (interface token) → TypeOrmOutboxRepository
 *
 * Application services inject IOutboxWriter.
 * OutboxProcessor injects IOutboxRepository.
 *
 * @Global — any module can use outbox without re-importing.
 */
@Global()
@Module({
    imports: [TypeOrmModule.forFeature([OutboxEvent])],
    providers: [
        TypeOrmOutboxWriter,
        TypeOrmOutboxRepository,
        {
            provide: 'IOutboxWriter',
            useExisting: TypeOrmOutboxWriter,
        },
        {
            provide: 'IOutboxRepository',
            useExisting: TypeOrmOutboxRepository,
        },
    ],
    exports: ['IOutboxWriter', 'IOutboxRepository', TypeOrmOutboxWriter, TypeOrmOutboxRepository],
})
export class OutboxModule {}
