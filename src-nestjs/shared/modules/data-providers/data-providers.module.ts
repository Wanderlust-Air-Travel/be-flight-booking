import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpClientService } from './services/http-client.service';
import { DataService } from './services/data.service';
import { OurairportsProvider } from './providers/ourairports.provider';
import { MockProvider } from './providers/mock.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    HttpClientService,
    OurairportsProvider,
    MockProvider,
    DataService,
  ],
  exports: [
    DataService,
    OurairportsProvider,
    MockProvider,
    HttpClientService,
  ],
})
export class DataProvidersModule {}
