import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentGateway,
  PaymentGatewayResponse,
  PaymentWebhookResult,
} from '../interfaces/payment-gateway.interface';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';

/**
 * DevPaymentGateway
 * Gateway dành riêng cho môi trường development/demo:
 * - Không gọi bất kỳ cổng thanh toán bên ngoài nào
 * - Tạo paymentUrl nội bộ để người dùng chọn "Success" / "Failed"
 * - Webhook /api/payments/webhooks/dev sẽ cập nhật trạng thái Payment
 */
@Injectable()
export class DevPaymentGateway implements IPaymentGateway {
  private readonly logger = new Logger(DevPaymentGateway.name);

  async createPayment(
    payment: Payment,
    booking: Booking,
  ): Promise<PaymentGatewayResponse> {
    this.logger.log(
      `[DEV] Creating dev payment ${payment.payment_id} for booking ${booking.booking_id}`,
    );

    // paymentUrl trỏ tới trang FE nội bộ để user chọn kết quả thanh toán
    const appUrl = process.env.APP_URL;
    const paymentUrl = `${appUrl}/payments/dev?paymentId=${payment.payment_id}&bookingId=${booking.booking_id}`;

    return {
      transactionId: payment.payment_id,
      paymentUrl,
      status: 'pending',
      message: 'Dev payment created. Redirect user to internal dev payment page.',
    };
  }

  // Trong môi trường dev, bỏ qua verify chữ ký
  verifyWebhook(signature: string, payload: any): boolean {
    this.logger.log('[DEV] Skipping webhook signature verification');
    return true;
  }

  async processWebhook(payload: any): Promise<PaymentWebhookResult> {
    this.logger.log(`[DEV] Processing webhook payload: ${JSON.stringify(payload)}`);

    const paymentId = payload.paymentId || payload.transactionId;
    const status =
      payload.status === 'success' || payload.status === 'SUCCESS'
        ? 'success'
        : 'failed';
    const amount = Number(payload.amount) || 0;

    return {
      transactionId: paymentId,
      status,
      amount,
      currency: 'VND',
      message:
        payload.message ||
        (status === 'success'
          ? 'Dev payment marked as successful'
          : 'Dev payment marked as failed'),
      gatewayData: payload,
    };
  }
}


