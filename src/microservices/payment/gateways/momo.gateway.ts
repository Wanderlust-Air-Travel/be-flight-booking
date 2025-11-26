import { Injectable, Logger } from '@nestjs/common';
import { IPaymentGateway, PaymentGatewayResponse, PaymentWebhookResult } from '../interfaces/payment-gateway.interface';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import * as crypto from 'crypto';

/**
 * MoMo Gateway integration (Server-to-server)
 * - createPayment: build payUrl with signed request to MoMo endpoint (or at least a correctly-signed URL)
 * - verifyWebhook: verify signature from MoMo
 * - processWebhook: parse resultCode to determine success/failed
 *
 * NOTE: Endpoint URLs & field names follow MoMo docs (Partner API v2) at a high level,
 * but you should validate against the official MoMo documentation for production.
 */
@Injectable()
export class MoMoGateway implements IPaymentGateway {
  private readonly logger = new Logger(MoMoGateway.name);

  private getConfig() {
    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const endpoint =
      process.env.MOMO_ENDPOINT ||
      'https://test-payment.momo.vn/v2/gateway/api/create';
    const returnUrl =
      process.env.MOMO_RETURN_URL ||
      `${process.env.APP_URL || 'http://localhost:3001'}/payments/momo/callback`;
    const ipnUrl =
      process.env.MOMO_IPN_URL ||
      `${process.env.APP_URL || 'http://localhost:3001'}/api/payments/webhooks/momo`;

    if (!partnerCode || !accessKey || !secretKey) {
      this.logger.warn(
        'MoMo config missing (MOMO_PARTNER_CODE / MOMO_ACCESS_KEY / MOMO_SECRET_KEY). Integration will run in degraded mode.',
      );
    }

    return { partnerCode, accessKey, secretKey, endpoint, returnUrl, ipnUrl };
  }

  async createPayment(
    payment: Payment,
    booking: Booking,
  ): Promise<PaymentGatewayResponse> {
    this.logger.log(
      `[MOMO] Creating payment ${payment.payment_id} for booking ${booking.booking_id}`,
    );

    const { partnerCode, accessKey, secretKey, endpoint, returnUrl, ipnUrl } =
      this.getConfig();

    // Nếu chưa cấu hình đầy đủ → không chặn flow, trả về URL mock
    if (!partnerCode || !accessKey || !secretKey) {
      const requestId = `MOMO-${Date.now()}-${payment.payment_id.substring(
        0,
        8,
      )}`;
      const payUrl = `https://test-payment.momo.vn/pay?requestId=${requestId}`;

      return {
        transactionId: requestId,
        paymentUrl: payUrl,
        status: 'pending',
        message:
          'MoMo config missing. Using mock payment URL. Please configure MOMO_PARTNER_CODE, MOMO_ACCESS_KEY and MOMO_SECRET_KEY for real payments.',
      };
    }

    const orderId = payment.payment_id;
    const requestId = `${partnerCode}-${orderId}-${Date.now()}`;
    const amount = Number(payment.amount);
    const orderInfo = `Payment for booking ${booking.pnr_code}`;

    // Raw signature (per common MoMo docs: partnerCode, accessKey, requestId, amount, orderId, orderInfo, returnUrl, ipnUrl, requestType)
    const requestType = 'captureWallet';
    const rawSignature =
      `accessKey=${accessKey}` +
      `&amount=${amount}` +
      `&extraData=` +
      `&ipnUrl=${ipnUrl}` +
      `&orderId=${orderId}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${partnerCode}` +
      `&redirectUrl=${returnUrl}` +
      `&requestId=${requestId}` +
      `&requestType=${requestType}`;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    // Trong production, bạn nên POST payload này tới MoMo endpoint và dùng payUrl trả về.
    // Ở đây ta build tạm một URL để redirect (phù hợp với sandbox/demo).
    const payUrl = `${endpoint}?${new URLSearchParams({
      partnerCode,
      accessKey,
      requestId,
      orderId,
      orderInfo,
      amount: String(amount),
      redirectUrl: returnUrl,
      ipnUrl,
      requestType,
      extraData: '',
      signature,
    }).toString()}`;

    return {
      transactionId: requestId,
      paymentUrl: payUrl,
      status: 'pending',
      message: 'Redirect user to MoMo payment page',
    };
  }

  verifyWebhook(signature: string, payload: any): boolean {
    this.logger.log('[MOMO] Verifying webhook signature');
    const { secretKey, accessKey, partnerCode } = this.getConfig();

    if (!secretKey || !accessKey || !partnerCode) {
      this.logger.warn(
        'MoMo secret/access key not configured. Skipping signature verification (DEV ONLY).',
      );
      return true;
    }

    try {
      // MoMo webhook thường gửi các field: amount, orderId, orderInfo, orderType, transId, resultCode, message, payType, responseTime, extraData, signature
      const {
        amount,
        orderId,
        orderInfo,
        orderType,
        transId,
        resultCode,
        message,
        payType,
        responseTime,
        extraData,
      } = payload;

      const rawSignature =
        `accessKey=${accessKey}` +
        `&amount=${amount}` +
        `&extraData=${extraData || ''}` +
        `&message=${message}` +
        `&orderId=${orderId}` +
        `&orderInfo=${orderInfo}` +
        `&orderType=${orderType || ''}` +
        `&partnerCode=${partnerCode}` +
        `&payType=${payType || ''}` +
        `&requestId=${payload.requestId || ''}` +
        `&responseTime=${responseTime}` +
        `&resultCode=${resultCode}` +
        `&transId=${transId}`;

      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');

      const receivedSignature = String(signature || payload.signature || '').trim();

      const isValid = expectedSignature === receivedSignature;
      if (!isValid) {
        this.logger.error(
          `[MOMO] Invalid webhook signature. expected=${expectedSignature}, received=${receivedSignature}`,
        );
      }

      return isValid;
    } catch (error: any) {
      this.logger.error(
        `[MOMO] Error verifying webhook: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  async processWebhook(payload: any): Promise<PaymentWebhookResult> {
    this.logger.log(`[MOMO] Processing webhook: ${JSON.stringify(payload)}`);

    try {
      const transactionId = payload.orderId || payload.transId;
      const isSuccess = Number(payload.resultCode) === 0;
      const amount = Number(payload.amount) || 0;

      return {
        transactionId,
        status: isSuccess ? 'success' : 'failed',
        amount,
        currency: 'VND',
        message: isSuccess ? 'Payment successful' : payload.message || 'Payment failed',
        gatewayData: payload,
      };
    } catch (error: any) {
      this.logger.error(
        `[MOMO] Error processing webhook: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}


