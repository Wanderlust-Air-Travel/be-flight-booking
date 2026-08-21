import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CircuitBreakerService } from '../../services/circuit-breaker.service';
import { LoggingService } from '../../services/logging.service';
import { MicroserviceClientService } from '../../services/microservice-client.service';
import { RetryService } from '../../services/retry.service';
import { TimeoutService } from '../../services/timeout.service';

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
