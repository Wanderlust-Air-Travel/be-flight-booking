import { Injectable, Logger } from '@nestjs/common';
import { IPaymentGateway, PaymentGatewayResponse, PaymentWebhookResult } from '../interfaces/payment-gateway.interface';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import * as crypto from 'crypto';
import * as qs from 'querystring';

/**
 * VNPay gateway implementation (lightweight, không phụ thuộc SDK ngoài)
 * - createPayment: sinh paymentUrl dạng VNPay sandbox/prod với chữ ký HMAC-SHA512
 * - verifyWebhook: verify chữ ký từ VNPay
 * - processWebhook: parse payload callback để trả về trạng thái thanh toán
 */
@Injectable()
export class VNPayGateway implements IPaymentGateway {
  private readonly logger = new Logger(VNPayGateway.name);

  private getConfig() {
    const tmnCode = process.env.VNPAY_TMN_CODE;
    const secretKey = process.env.VNPAY_SECRET_KEY;
    const vnpUrl =
      process.env.VNPAY_URL ||
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl =
      process.env.VNPAY_RETURN_URL ||
      `${process.env.APP_URL || 'http://localhost:3001'}/payments/vnpay/callback`;

    if (!tmnCode || !secretKey) {
      this.logger.warn(
        'VNPay config missing (VNPAY_TMN_CODE / VNPAY_SECRET_KEY). Integration will run in degraded mode.',
      );
    }

    return { tmnCode, secretKey, vnpUrl, returnUrl };
  }

  async createPayment(
    payment: Payment,
    booking: Booking,
  ): Promise<PaymentGatewayResponse> {
    this.logger.log(
      `[VNPAY] Creating payment ${payment.payment_id} for booking ${booking.booking_id}`,
    );

    const { tmnCode, secretKey, vnpUrl, returnUrl } = this.getConfig();

    // Nếu thiếu config thì vẫn trả về URL mock (để không chặn flow dev)
    if (!tmnCode || !secretKey) {
      const transactionId = `VNPAY-${Date.now()}-${payment.payment_id.substring(
        0,
        8,
      )}`;
      const paymentUrl = `${vnpUrl}?txnRef=${transactionId}`;

      return {
        transactionId,
        paymentUrl,
        status: 'pending',
        message:
          'VNPay config missing. Using mock payment URL. Please configure VNPAY_TMN_CODE and VNPAY_SECRET_KEY for real payments.',
      };
    }

    // Build VNPay params (theo spec cơ bản)
    const createDate = this.formatDate(new Date()); // yyyyMMddHHmmss
    const amount = Number(payment.amount) * 100; // VNPay sử dụng VND * 100
    const orderInfo = `Payment for booking ${booking.pnr_code}`;
    const orderType = 'other';
    const ipAddr = '127.0.0.1'; // Có thể truyền IP thực nếu cần

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(amount),
      vnp_CurrCode: payment.currency.currency_code || 'VND',
      vnp_TxnRef: payment.payment_id,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: orderType,
      vnp_Locale: 'vn',
      vnp_CreateDate: createDate,
      vnp_IpAddr: ipAddr,
      vnp_ReturnUrl: returnUrl,
    };

    // Sort keys & sign
    const sortedKeys = Object.keys(vnpParams).sort();
    const signData = sortedKeys
      .map((key) => `${key}=${vnpParams[key]}`)
      .join('&');
    const secureHash = crypto
      .createHmac('sha512', secretKey)
      .update(signData)
      .digest('hex');

    const query = qs.stringify({
      ...vnpParams,
      vnp_SecureHash: secureHash,
    });

    const paymentUrl = `${vnpUrl}?${query}`;

    return {
      transactionId: payment.payment_id,
      paymentUrl,
      status: 'pending',
      message: 'Redirect user to VNPay payment page',
    };
  }

  verifyWebhook(signature: string, payload: any): boolean {
    this.logger.log('[VNPAY] Verifying webhook signature');

    const { secretKey } = this.getConfig();

    // Nếu chưa cấu hình secretKey → không chặn webhook (dev mode)
    if (!secretKey) {
      this.logger.warn(
        'VNPAY_SECRET_KEY is not set. Skipping signature verification (DEV ONLY).',
      );
      return true;
    }

    try {
      // VNPay thường gửi tất cả params trong query hoặc body
      // Loại bỏ vnp_SecureHash & vnp_SecureHashType khỏi dữ liệu ký
      const data: Record<string, string> = { ...payload };
      const secureHashFromPayload =
        data.vnp_SecureHash ||
        data.vnp_SecureHash2 ||
        signature ||
        '';

      delete data.vnp_SecureHash;
      delete data.vnp_SecureHashType;
      delete data.vnp_SecureHash2;

      const sortedKeys = Object.keys(data).sort();
      const signData = sortedKeys
        .map((key) => `${key}=${data[key]}`)
        .join('&');

      const expectedHash = crypto
        .createHmac('sha512', secretKey)
        .update(signData)
        .digest('hex')
        .toUpperCase();

      const receivedHash = String(secureHashFromPayload).toUpperCase();

      const isValid = expectedHash === receivedHash;
      if (!isValid) {
        this.logger.error(
          `[VNPAY] Invalid webhook signature. expected=${expectedHash}, received=${receivedHash}`,
        );
      }

      return isValid;
    } catch (error: any) {
      this.logger.error(
        `[VNPAY] Error verifying webhook: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  async processWebhook(payload: any): Promise<PaymentWebhookResult> {
    this.logger.log(`[VNPAY] Processing webhook: ${JSON.stringify(payload)}`);

    try {
      // Theo spec cơ bản của VNPay
      const transactionId = payload.vnp_TxnRef || payload.vnp_TransactionNo;
      const responseCode = payload.vnp_ResponseCode || payload.vnp_TransactionStatus;
      const isSuccess = responseCode === '00';
      const amount =
        payload.vnp_Amount != null
          ? Number(payload.vnp_Amount) / 100
          : 0;

      return {
        transactionId,
        status: isSuccess ? 'success' : 'failed',
        amount,
        currency: payload.vnp_CurrCode || 'VND',
        message: isSuccess ? 'Payment successful' : 'Payment failed',
        gatewayData: payload,
      };
    } catch (error: any) {
      this.logger.error(
        `[VNPAY] Error processing webhook: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async processRefund(
    transactionId: string,
    amount: number,
  ): Promise<string> {
    this.logger.log(
      `[VNPAY] Processing refund for transaction ${transactionId}, amount: ${amount}`,
    );
    // Tùy nhu cầu, có thể implement gọi API refund VNPay sau
    return `VNPAY-REFUND-${Date.now()}-${transactionId.substring(0, 8)}`;
  }

  private formatDate(date: Date): string {
    // yyyyMMddHHmmss
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    const second = pad(date.getSeconds());
    return `${year}${month}${day}${hour}${minute}${second}`;
  }
}


