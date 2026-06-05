import { type ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { RpcExceptionFilter } from '@nestjs/common/interfaces/exceptions';
import { RpcException } from '@nestjs/microservices';
import { type Observable, throwError } from 'rxjs';

/**
 * PaymentRpcExceptionFilter
 *
 * Chuẩn hóa lỗi trong Payment Microservice trước khi gửi qua transport layer.
 * Mục tiêu:
 * - Đảm bảo Gateway luôn nhận được object có statusCode + message rõ ràng
 * - Phân biệt lỗi business (4xx) với lỗi hệ thống (5xx)
 */
@Catch()
export class PaymentRpcExceptionFilter implements RpcExceptionFilter<any> {
    catch(exception: any, _host: ArgumentsHost): Observable<any> {
        // 1. Xác định HTTP status code hợp lý
        const statusCode =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        // 2. Lấy thông tin response từ HttpException (nếu có)
        const response =
            exception instanceof HttpException
                ? exception.getResponse()
                : { message: exception?.message || 'Internal server error' };

        const message =
            typeof response === 'string'
                ? response
                : (response as any).message || exception?.message || 'Internal server error';

        const errorName =
            (response as any).error || (exception?.name as string) || 'PaymentMicroserviceError';

        // 3. Đóng gói thành RpcException với payload chuẩn
        return throwError(
            () =>
                new RpcException({
                    statusCode,
                    message,
                    error: errorName,
                })
        );
    }
}
