import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

/**
 * RpcToHttpExceptionFilter
 *
 * Dùng ở API Gateway để chuyển RpcException từ microservice
 * thành HttpException với status code chính xác cho client.
 */
@Catch(RpcException)
export class RpcToHttpExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    const error: any = exception.getError();

    const statusCode: number =
      (typeof error === 'object' && error?.statusCode) || HttpStatus.BAD_GATEWAY;

    const message: string =
      (typeof error === 'object' && error?.message) ||
      (exception as any).message ||
      'Service unavailable';

    const errorName: string =
      (typeof error === 'object' && error?.error) || 'Bad Gateway';

    // Nếu statusCode là 5xx → coi như lỗi hạ tầng, giữ nguyên 5xx
    if (statusCode >= 500) {
      res.status(statusCode).json({
        statusCode,
        message,
        error: errorName,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Với 4xx, trả lại đúng 4xx để FE hiển thị lỗi business
    res.status(statusCode).json({
      statusCode,
      message,
      error: errorName,
      timestamp: new Date().toISOString(),
    });
  }
}


