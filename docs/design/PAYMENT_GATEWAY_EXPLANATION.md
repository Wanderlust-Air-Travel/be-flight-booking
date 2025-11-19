# Payment Gateway - Mock vs Real Implementation

## Tại sao có Mock Payment Gateway?

### 1. **Mục đích của Mock Gateway**

Mock Payment Gateway được tạo ra với các mục đích:

#### **Development & Testing**
- **Không cần tích hợp ngay** với payment gateway thực tế (VNPay, MoMo, Stripe)
- **Phát triển song song**: Dev có thể code business logic mà không cần đợi API keys, credentials từ payment gateway
- **Test dễ dàng**: Không cần setup sandbox environment, không tốn phí test transactions

#### **Architecture Pattern**
- **Dependency Inversion**: Code phụ thuộc vào **interface** (`IPaymentGateway`), không phụ thuộc vào implementation cụ thể
- **Easy to Switch**: Chỉ cần thay đổi trong Factory, không cần sửa code business logic
- **Multiple Gateways**: Dễ dàng support nhiều payment gateways cùng lúc

#### **Production Ready Structure**
- **Interface đã định nghĩa sẵn**: Khi implement gateway thực tế, chỉ cần implement interface
- **Consistent API**: Tất cả gateways đều có cùng interface, dễ maintain

---

## Mock Gateway hiện tại làm gì?

```typescript
// Mock Gateway hiện tại:
1. createPayment() → Tạo transaction ID giả, payment URL giả
2. verifyWebhook() → Luôn return true (không verify thật)
3. processWebhook() → Parse payload và return result giả
4. processRefund() → Tạo refund ID giả
```

**Tất cả đều là simulation**, không gọi API thật, không có tiền thật chuyển khoản.

---

## Khi nào cần implement Gateway thực tế?

### **Development Phase** (Hiện tại)
- Dùng Mock Gateway
- Test business logic
- Test flow payment

### **Staging/Production Phase**
- Phải thay Mock bằng Real Gateway
- Cần API keys, credentials
- Cần test với sandbox trước

---

## Cách implement Gateway thực tế

### **Ví dụ: VNPay Gateway**

Khi implement VNPay thực tế, bạn sẽ:

1. **Install VNPay SDK**
```bash
npm install vnpay
```

2. **Tạo VNPayGateway class**
```typescript
@Injectable()
export class VNPayGateway implements IPaymentGateway {
  private readonly vnpay: VNPay;
  
  constructor() {
    this.vnpay = new VNPay({
      tmnCode: process.env.VNPAY_TMN_CODE,
      secretKey: process.env.VNPAY_SECRET_KEY,
      testMode: process.env.NODE_ENV !== 'production'
    });
  }

  async createPayment(payment: Payment, booking: Booking): Promise<PaymentGatewayResponse> {
    // GỌI API THẬT CỦA VNPAY
    const vnpayUrl = await this.vnpay.buildPaymentUrl({
      amount: payment.amount,
      orderId: payment.payment_id,
      orderDescription: `Payment for booking ${booking.pnr_code}`,
      returnUrl: `${process.env.APP_URL}/payments/callback`,
      // ... other params
    });

    return {
      transactionId: payment.payment_id,
      paymentUrl: vnpayUrl, // URL THẬT để redirect user
      status: 'pending',
    };
  }

  verifyWebhook(signature: string, payload: any): boolean {
    // VERIFY SIGNATURE THẬT
    return this.vnpay.verifySignature(payload, signature);
  }

  async processWebhook(payload: any): Promise<PaymentWebhookResult> {
    // PARSE WEBHOOK THẬT TỪ VNPAY
    const result = this.vnpay.parseCallback(payload);
    
    return {
      transactionId: result.transactionId,
      status: result.responseCode === '00' ? 'success' : 'failed',
      amount: result.amount,
      currency: 'VND',
    };
  }
}
```

3. **Update Factory**
```typescript
create(methodCode: string): IPaymentGateway {
  switch (methodCode.toUpperCase()) {
    case 'EWALLET':
      // Thay Mock bằng VNPay thật
      return new VNPayGateway(); // ← Thay đổi ở đây
    // ...
  }
}
```

---

## Best Practice

### **1. Development Environment**
```typescript
// .env.development
PAYMENT_GATEWAY_MODE=mock
```

### **2. Production Environment**
```typescript
// .env.production
PAYMENT_GATEWAY_MODE=real
VNPAY_TMN_CODE=xxx
VNPAY_SECRET_KEY=xxx
```

### **3. Factory Pattern với Environment Check**
```typescript
create(methodCode: string): IPaymentGateway {
  if (process.env.PAYMENT_GATEWAY_MODE === 'mock') {
    return this.mockGateway; // Development
  }

  // Production - Real gateways
  switch (methodCode.toUpperCase()) {
    case 'EWALLET':
      return new VNPayGateway();
    case 'CREDIT_CARD':
      return new StripeGateway();
    // ...
  }
}
```

---

## Tóm tắt

| Aspect | Mock Gateway | Real Gateway |
|--------|-------------|--------------|
| **Mục đích** | Development, Testing | Production |
| **API Calls** | Không có | Có (VNPay, MoMo, etc.) |
| **Tiền thật** | Không | Có |
| **Credentials** | Không cần | Cần API keys |
| **Webhook** | Fake | Real từ gateway |
| **Khi nào dùng** | Dev, Test | Production |

---

## Kết luận

**Mock Gateway là bước đầu tiên** để:
1. Xây dựng architecture đúng
2. Test business logic
3. Phát triển song song

**Khi sẵn sàng production**, chỉ cần:
1. Implement Real Gateway (VNPay, MoMo, etc.)
2. Update Factory
3. Thêm credentials vào .env
4. Test với sandbox
5. Deploy production
