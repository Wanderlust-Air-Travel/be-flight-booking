import { Module } from '@nestjs/common';
// import { OutboxModule } from '../../../shared/modules/outbox/outbox.module';
import {
    GetFareOptionsHandler,
    GetFlightDetailsHandler,
    SearchFlightHandler,
} from './application/handlers/search.handlers';
import { SearchMessageHandler } from './interface/search.message-handler';

/**
 * SearchModule — Wires the search bounded context.
 *
 * The ISearchAdapter is intentionally left unbound — production swaps in
 * a TypeORM-backed repository adapter or external API client.
 */
@Module({
    imports: [],
    controllers: [SearchMessageHandler],
    providers: [SearchFlightHandler, GetFareOptionsHandler, GetFlightDetailsHandler],
    exports: [],
})
export class SearchModule {}
