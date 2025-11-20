# Payment Gateway - Mock vs Real Implementation

## Tại sao có Mock Payment Gateway?

### Mục đích
- **Development & Testing**: Không cần tích hợp ngay với payment gateway thực tế
- **Architecture Pattern**: Dependency Inversion - code phụ thuộc vào interface, không phụ thuộc vào implementation
- **Easy to Switch**: Chỉ cần thay đổi trong Factory, không cần sửa business logic

### Mock Gateway hiện tại
```typescript
// Mock Gateway chỉ simulation:
1. createPayment() → Tạo transaction ID giả, payment URL giả
2. verifyWebhook() → Luôn return true (không verify thật)
3. processWebhook() → Parse payload và return result giả
```

**Tất cả đều là simulation**, không gọi API thật, không có tiền thật chuyển khoản.

## Khi nào cần implement Gateway thực tế?

- **Development Phase**: Dùng Mock Gateway
- **Staging/Production Phase**: Phải thay Mock bằng Real Gateway

## Cách implement Gateway thực tế

### Ví dụ: VNPay Gateway

1. **Install VNPay SDK**
```bash
npm install vnpay
```

2. **Tạo VNPayGateway class**
```typescript
import { IPaymentGateway, PaymentGatewayResponse } from '../interfaces/payment-gateway.interface';

@Injectable()
export class VNPayGateway implements IPaymentGateway {
  async createPayment(payment: Payment, booking: Booking): Promise<PaymentGatewayResponse> {
    // GỌI API THẬT CỦA VNPAY
    const vnpayUrl = await this.vnpay.buildPaymentUrl({...});
    return { transactionId, paymentUrl: vnpayUrl, status: 'pending' };
  }

  verifyWebhook(signature: string, payload: any): boolean {
    // VERIFY SIGNATURE THẬT
    return this.vnpay.verifySignature(payload, signature);
  }
}
```

3. **Update Factory**
```typescript
create(methodCode: string): IPaymentGateway {
  switch (methodCode.toUpperCase()) {
    case 'EWALLET':
      return new VNPayGateway(); // ← Thay Mock bằng VNPay thật
  }
}
```

## Best Practice

- **Development**: `PAYMENT_GATEWAY_MODE=mock`
- **Production**: `PAYMENT_GATEWAY_MODE=real` + API keys

## Tóm tắt

| Aspect | Mock Gateway | Real Gateway |
|--------|-------------|--------------|
| **Mục đích** | Development, Testing | Production |
| **API Calls** | Không có | Có (VNPay, MoMo, etc.) |
| **Tiền thật** | Không | Có |
| **Credentials** | Không cần | Cần API keys |
