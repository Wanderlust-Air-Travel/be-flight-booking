import {
    type ArgumentsHost,
    BadRequestException,
    Catch,
    type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
    catch(exception: BadRequestException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        response.status(status).json(exceptionResponse);
    }
}
