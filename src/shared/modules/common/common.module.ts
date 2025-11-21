import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggingService } from '../../services/logging.service';
import { CircuitBreakerService } from '../../services/circuit-breaker.service';
import { RetryService } from '../../services/retry.service';
import { TimeoutService } from '../../services/timeout.service';
import { MicroserviceClientService } from '../../services/microservice-client.service';

@Global()
@Module({
	imports: [ConfigModule],
	providers: [
		LoggingService,
		CircuitBreakerService,
		RetryService,
		TimeoutService,
		MicroserviceClientService,
	],
	exports: [
		LoggingService,
		CircuitBreakerService,
		RetryService,
		TimeoutService,
		MicroserviceClientService,
	],
})
export class CommonModule {}

