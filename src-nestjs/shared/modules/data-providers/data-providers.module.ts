import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MockProvider } from './providers/mock.provider';
import { OurairportsProvider } from './providers/ourairports.provider';
import { DataService } from './services/data.service';
import { HttpClientService } from './services/http-client.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [HttpClientService, OurairportsProvider, MockProvider, DataService],
    exports: [DataService, OurairportsProvider, MockProvider, HttpClientService],
})
export class DataProvidersModule {}
