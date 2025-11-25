import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SEARCH_MS } from 'src/microservices/search/search.messages';
import { SearchController } from './search.controller';
import { BookingStateModule } from '../booking-state/booking-state.module';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [
		ClientsModule.register([
			{
				name: 'SEARCH_CLIENT',
				transport: Transport.TCP,
				options: {
					host: SEARCH_MS.TCP_HOST,
					port: SEARCH_MS.TCP_PORT,
				},
			},
		]),
		BookingStateModule,
		AuthModule, // Import AuthModule to use OptionalJwtAuthGuard
	],
	controllers: [SearchController],
})
export class SearchClientModule {}


