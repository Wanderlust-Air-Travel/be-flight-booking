import { Module } from '@nestjs/common';
import { OutboxModule } from '../../shared/modules/outbox/outbox.module';
import {
    GetFareOptionsHandler,
    GetFlightDetailsHandler,
    SearchFlightHandler,
} from './application/handlers/search.handlers';
import { TypeOrmSearchAdapter } from './infrastructure/adapters/typeorm-search.adapter';
import { SearchMessageHandler } from './interface/search.message-handler';

/**
 * SearchModule — Wires the search bounded context.
 *
 * ISearchAdapter is bound to TypeOrmSearchAdapter, which reads flight
 * instances / schedules / routes / fare-classes from SQL Server via
 * the TypeORM DataSource already configured in main.search.ts.
 *
 * IOutboxWriter comes from the @Global OutboxModule.
 */
@Module({
    imports: [OutboxModule],
    controllers: [SearchMessageHandler],
    providers: [
        TypeOrmSearchAdapter,
        {
            provide: 'ISearchAdapter',
            useClass: TypeOrmSearchAdapter,
        },
        SearchFlightHandler,
        GetFareOptionsHandler,
        GetFlightDetailsHandler,
    ],
    exports: [],
})
export class SearchModule {}
