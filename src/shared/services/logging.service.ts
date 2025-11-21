import { Injectable, Logger } from '@nestjs/common';

export interface LogContext {
	[key: string]: any;
}

@Injectable()
export class LoggingService {
	private readonly logger = new Logger(LoggingService.name);

	log(context: string, message: string, meta?: LogContext) {
		const logData = {
			context,
			message,
			timestamp: new Date().toISOString(),
			...(meta || {}),
		};
		this.logger.log(JSON.stringify(logData, null, 2));
	}

	error(context: string, message: string, error?: Error, meta?: LogContext) {
		const logData = {
			context,
			message,
			error: error?.message,
			stack: error?.stack,
			timestamp: new Date().toISOString(),
			...(meta || {}),
		};
		this.logger.error(JSON.stringify(logData, null, 2));
	}

	warn(context: string, message: string, meta?: LogContext) {
		const logData = {
			context,
			message,
			timestamp: new Date().toISOString(),
			...(meta || {}),
		};
		this.logger.warn(JSON.stringify(logData, null, 2));
	}

	debug(context: string, message: string, meta?: LogContext) {
		const logData = {
			context,
			message,
			timestamp: new Date().toISOString(),
			...(meta || {}),
		};
		this.logger.debug(JSON.stringify(logData, null, 2));
	}
}

