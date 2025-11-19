# Payment Service Analysis & Best Practices

## Tổng quan

Document này phân tích Payment Service hiện tại và đề xuất các cải thiện để đạt chuẩn best practice cho production.

---

## ✅ Điểm mạnh hiện tại

1. **Transaction Safety**: Sử dụng TypeORM transactions đúng cách
2. **Validation**: Validate booking ownership, status, payment method
3. **Error Handling**: Có try-catch và rollback transaction
4. **Logging**: Có logging cho các operations quan trọng
5. **JWT Authentication**: Extract userId từ Gateway (best practice)
6. **Auto-update Booking Status**: Tự động update booking status khi payment success
7. **Microservice Architecture**: Tách biệt rõ ràng, dễ scale

---

## ⚠️ Các điểm cần cải thiện cho Production

### 1. **Idempotency & Duplicate Payment Prevention** (CRITICAL)

**Vấn đề:**
- Chưa có cơ chế prevent duplicate payment
- User có thể tạo nhiều payments cho cùng một booking
- Không có idempotency key để đảm bảo request chỉ được xử lý một lần

**Giải pháp:**
```typescript
// Thêm idempotency key vào DTO
class CreatePaymentDto {
  idempotencyKey?: string; // Optional, nếu có thì check duplicate
  // ... existing fields
}

// Check duplicate payment
async createPayment(userId: string, dto: CreatePaymentDto) {
  // Check existing successful payment
  const existingPayment = await this.paymentRepo.findOne({
    where: {
      booking: { booking_id: dto.bookingId },
      status: 'success'
    }
  });
  
  if (existingPayment) {
    throw new BadRequestException('Booking already has a successful payment');
  }
  
  // Check idempotency key nếu có
  if (dto.idempotencyKey) {
    const existing = await this.paymentRepo.findOne({
      where: { transaction_ref: dto.idempotencyKey }
    });
    if (existing) {
      return this.mapToPaymentResponseDto(existing, ...);
    }
  }
}
```

**Priority**: 🔴 HIGH

---

### 2. **Amount Validation** (CRITICAL)

**Vấn đề:**
- Payment amount luôn lấy từ `booking.total_amount`
- Không support partial payment
- Không validate amount có thể thay đổi sau khi booking được tạo

**Giải pháp:**
```typescript
// Option 1: Strict validation (recommended cho flight booking)
// Payment amount PHẢI bằng booking.total_amount
if (dto.amount && dto.amount !== booking.total_amount) {
  throw new BadRequestException(
    `Payment amount (${dto.amount}) must equal booking total amount (${booking.total_amount})`
  );
}

// Option 2: Support partial payment (nếu business logic cho phép)
// Tính tổng payments đã thành công
const totalPaid = await this.calculateTotalPaid(booking.booking_id);
const remainingAmount = booking.total_amount - totalPaid;

if (dto.amount > remainingAmount) {
  throw new BadRequestException(
    `Payment amount (${dto.amount}) exceeds remaining amount (${remainingAmount})`
  );
}
```

**Priority**: 🔴 HIGH

---

### 3. **Payment Expiration** (IMPORTANT)

**Vấn đề:**
- Payment với status `pending` không có expiration
- User có thể tạo payment và không thanh toán, để pending mãi

**Giải pháp:**
```typescript
// Thêm expires_at vào Payment entity
@Column({ type: 'datetime2', nullable: true })
expires_at: Date | null;

// Set expiration khi tạo payment (ví dụ: 15 phút)
const expiresAt = new Date();
expiresAt.setMinutes(expiresAt.getMinutes() + 15);

// Validate expiration khi process payment
if (payment.expires_at && payment.expires_at < new Date()) {
  throw new BadRequestException('Payment has expired');
}
```

**Priority**: 🟡 MEDIUM

---

### 4. **Payment Gateway Integration Structure** (CRITICAL)

**Vấn đề:**
- Hiện tại chỉ simulate payment processing
- Chưa có structure để tích hợp payment gateway thực tế (VNPay, MoMo, Stripe, etc.)

**Giải pháp:**
```typescript
// Tạo Payment Gateway Interface
interface IPaymentGateway {
  createPayment(payment: Payment, booking: Booking): Promise<PaymentGatewayResponse>;
  verifyWebhook(signature: string, payload: any): boolean;
  processWebhook(payload: any): Promise<PaymentWebhookResult>;
}

// Payment Gateway Factory
class PaymentGatewayFactory {
  static create(methodCode: string): IPaymentGateway {
    switch (methodCode) {
      case 'VNPAY':
        return new VNPayGateway();
      case 'MOMO':
        return new MoMoGateway();
      case 'CREDIT_CARD':
        return new StripeGateway();
      default:
        throw new Error(`Unsupported payment method: ${methodCode}`);
    }
  }
}

// Update processPayment
async processPayment(userId: string, dto: CreatePaymentDto) {
  // ... create payment ...
  
  // Call payment gateway
  const gateway = PaymentGatewayFactory.create(dto.paymentMethodCode);
  const gatewayResponse = await gateway.createPayment(payment, booking);
  
  // Update payment with gateway transaction ID
  payment.transaction_ref = gatewayResponse.transactionId;
  await this.paymentRepo.save(payment);
  
  // Return payment URL hoặc redirect URL
  return {
    ...paymentResponse,
    paymentUrl: gatewayResponse.paymentUrl, // Redirect user to payment gateway
    gatewayTransactionId: gatewayResponse.transactionId
  };
}
```

**Priority**: 🔴 HIGH

---

### 5. **Webhook Handling** (CRITICAL)

**Vấn đề:**
- Chưa có endpoint để nhận webhook từ payment gateway
- Payment status update phải manual hoặc polling

**Giải pháp:**
```typescript
// Thêm webhook endpoint
@Post('webhooks/:gateway')
async handleWebhook(
  @Param('gateway') gateway: string,
  @Body() payload: any,
  @Headers('x-signature') signature: string
) {
  const gatewayService = PaymentGatewayFactory.create(gateway);
  
  // Verify webhook signature
  if (!gatewayService.verifyWebhook(signature, payload)) {
    throw new UnauthorizedException('Invalid webhook signature');
  }
  
  // Process webhook
  const result = await gatewayService.processWebhook(payload);
  
  // Update payment status
  await this.updatePaymentStatusFromWebhook(result);
  
  return { success: true };
}

// Update payment status from webhook
private async updatePaymentStatusFromWebhook(result: PaymentWebhookResult) {
  const payment = await this.paymentRepo.findOne({
    where: { transaction_ref: result.transactionId }
  });
  
  if (!payment) {
    this.logger.warn(`Payment not found for transaction: ${result.transactionId}`);
    return;
  }
  
  // Update status
  payment.status = result.status; // 'success' | 'failed'
  if (result.status === 'success') {
    payment.paid_at = new Date();
  }
  await this.paymentRepo.save(payment);
  
  // Update booking status
  if (result.status === 'success') {
    await this.bookingRepo.update(
      { booking_id: payment.booking_id },
      { status: 'paid', updated_at: new Date() }
    );
  }
}
```

**Priority**: 🔴 HIGH

---

### 6. **Partial Payment Support** (OPTIONAL)

**Vấn đề:**
- Hiện tại chỉ support full payment
- Một số business cases cần partial payment (trả góp, deposit, etc.)

**Giải pháp:**
```typescript
// Tính tổng payments đã thành công
private async calculateTotalPaid(bookingId: string): Promise<number> {
  const result = await this.paymentRepo
    .createQueryBuilder('payment')
    .select('SUM(payment.amount)', 'total')
    .where('payment.booking_id = :bookingId', { bookingId })
    .andWhere('payment.status = :status', { status: 'success' })
    .getRawOne();
  
  return Number(result?.total || 0);
}

// Validate partial payment
async createPayment(userId: string, dto: CreatePaymentDto) {
  // ... existing validation ...
  
  // Check if partial payment is allowed
  const totalPaid = await this.calculateTotalPaid(booking.booking_id);
  const remainingAmount = booking.total_amount - totalPaid;
  
  const paymentAmount = dto.amount || booking.total_amount;
  
  if (paymentAmount > remainingAmount) {
    throw new BadRequestException(
      `Payment amount (${paymentAmount}) exceeds remaining amount (${remainingAmount})`
    );
  }
  
  // Create payment với amount từ dto (nếu có)
  const payment = {
    amount: paymentAmount,
    // ... other fields
  };
  
  // Update booking status nếu fully paid
  if (totalPaid + paymentAmount >= booking.total_amount) {
    booking.status = 'paid';
  }
}
```

**Priority**: 🟢 LOW (chỉ nếu business requirement cần)

---

### 7. **Payment Retry Logic** (IMPORTANT)

**Vấn đề:**
- Khi payment failed, user phải tạo payment mới
- Không có cơ chế retry tự động

**Giải pháp:**
```typescript
// Thêm retry_count vào Payment entity
@Column({ type: 'int', default: 0 })
retry_count: number;

@Column({ type: 'datetime2', nullable: true })
last_retry_at: Date | null;

// Retry payment
async retryPayment(userId: string, paymentId: string) {
  const payment = await this.paymentRepo.findOne({
    where: { payment_id: paymentId },
    relations: ['booking']
  });
  
  if (payment.status !== 'failed') {
    throw new BadRequestException('Can only retry failed payments');
  }
  
  if (payment.retry_count >= 3) {
    throw new BadRequestException('Maximum retry attempts reached');
  }
  
  // Reset payment status
  payment.status = 'pending';
  payment.retry_count += 1;
  payment.last_retry_at = new Date();
  await this.paymentRepo.save(payment);
  
  // Retry payment processing
  return this.processPayment(userId, {
    bookingId: payment.booking_id,
    paymentMethodCode: payment.payment_method_code,
    transactionRef: payment.transaction_ref
  });
}
```

**Priority**: 🟡 MEDIUM

---

### 8. **Refund Support** (IMPORTANT)

**Vấn đề:**
- Chưa có logic refund khi booking bị cancel
- Không track refund history

**Giải pháp:**
```typescript
// Thêm Refund entity
@Entity({ name: 'Refunds', schema: 'dbo' })
export class Refund {
  @PrimaryColumn('uniqueidentifier')
  refund_id: string;
  
  @ManyToOne(() => Payment)
  payment: Payment;
  
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;
  
  @Column({ type: 'varchar', length: 20 })
  status: string; // pending, processed, failed
  
  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string;
  
  @Column({ type: 'datetime2', nullable: true })
  processed_at: Date | null;
}

// Refund payment
async refundPayment(userId: string, paymentId: string, reason: string) {
  const payment = await this.paymentRepo.findOne({
    where: { payment_id: paymentId },
    relations: ['booking']
  });
  
  if (payment.status !== 'success') {
    throw new BadRequestException('Can only refund successful payments');
  }
  
  // Create refund record
  const refund = await this.refundRepo.save({
    refund_id: uuidv7(),
    payment,
    amount: payment.amount,
    status: 'pending',
    reason
  });
  
  // Call payment gateway refund API
  const gateway = PaymentGatewayFactory.create(payment.payment_method_code);
  await gateway.processRefund(payment.transaction_ref, payment.amount);
  
  // Update refund status
  refund.status = 'processed';
  refund.processed_at = new Date();
  await this.refundRepo.save(refund);
  
  // Update booking status
  await this.bookingRepo.update(
    { booking_id: payment.booking_id },
    { status: 'refunded', updated_at: new Date() }
  );
}
```

**Priority**: 🟡 MEDIUM

---

### 9. **Payment History & Audit Trail** (IMPORTANT)

**Vấn đề:**
- Chưa có audit trail cho payment status changes
- Không track ai thay đổi payment status

**Giải pháp:**
```typescript
// Thêm PaymentHistory entity
@Entity({ name: 'PaymentHistory', schema: 'dbo' })
export class PaymentHistory {
  @PrimaryColumn('uniqueidentifier')
  history_id: string;
  
  @ManyToOne(() => Payment)
  payment: Payment;
  
  @Column({ type: 'varchar', length: 20 })
  old_status: string;
  
  @Column({ type: 'varchar', length: 20 })
  new_status: string;
  
  @Column({ type: 'varchar', length: 100, nullable: true })
  changed_by: string; // userId hoặc 'system' hoặc 'webhook'
  
  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string;
  
  @CreateDateColumn()
  created_at: Date;
}

// Log payment status change
private async logPaymentStatusChange(
  payment: Payment,
  oldStatus: string,
  newStatus: string,
  changedBy: string,
  reason?: string
) {
  await this.paymentHistoryRepo.save({
    history_id: uuidv7(),
    payment,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy,
    reason
  });
}
```

**Priority**: 🟡 MEDIUM

---

### 10. **Concurrency Control** (CRITICAL)

**Vấn đề:**
- Nếu user click "Pay" nhiều lần, có thể tạo nhiều payments
- Race condition khi update booking status

**Giải pháp:**
```typescript
// Sử dụng database lock
async processPayment(userId: string, dto: CreatePaymentDto) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  
  try {
    // Lock booking row để prevent concurrent payments
    const booking = await queryRunner.manager
      .createQueryBuilder(Booking, 'booking')
      .setLock('pessimistic_write') // SQL Server: WITH (UPDLOCK, ROWLOCK)
      .where('booking.booking_id = :bookingId', { bookingId: dto.bookingId })
      .getOne();
    
    // Check if already paid (after lock)
    if (booking.status === 'paid') {
      throw new BadRequestException('Booking is already paid');
    }
    
    // ... rest of payment processing ...
  } finally {
    await queryRunner.release();
  }
}
```

**Priority**: 🔴 HIGH

---

### 11. **Payment Method Availability** (IMPORTANT)

**Vấn đề:**
- Chưa check payment method có available không
- Một số payment methods có thể bị disable

**Giải pháp:**
```typescript
// Thêm is_active vào PaymentMethod entity
@Column({ type: 'bit', default: true })
is_active: boolean;

// Validate payment method availability
const paymentMethod = await this.paymentMethodRepo.findOne({
  where: { payment_method_code: dto.paymentMethodCode }
});

if (!paymentMethod || !paymentMethod.is_active) {
  throw new BadRequestException(
    `Payment method ${dto.paymentMethodCode} is not available`
  );
}
```

**Priority**: 🟡 MEDIUM

---

### 12. **Payment Notification** (IMPORTANT)

**Vấn đề:**
- Chưa gửi email/SMS khi payment success/failed
- User không được thông báo về payment status

**Giải pháp:**
```typescript
// Inject notification service (email/SMS)
@Inject('NOTIFICATION_CLIENT') private readonly notificationClient: ClientProxy

// Send notification after payment
private async sendPaymentNotification(
  payment: Payment,
  booking: Booking,
  status: 'success' | 'failed'
) {
  await firstValueFrom(
    this.notificationClient.send('notification.send-email', {
      to: booking.contact_email,
      template: status === 'success' ? 'payment-success' : 'payment-failed',
      data: {
        pnrCode: booking.pnr_code,
        amount: payment.amount,
        paymentMethod: payment.payment_method.name,
        transactionRef: payment.transaction_ref
      }
    })
  );
}
```

**Priority**: 🟡 MEDIUM

---

## 📊 Priority Summary

| Feature | Priority | Impact | Effort |
|---------|----------|--------|--------|
| Idempotency & Duplicate Prevention | 🔴 HIGH | Critical | Medium |
| Amount Validation | 🔴 HIGH | Critical | Low |
| Payment Gateway Integration | 🔴 HIGH | Critical | High |
| Webhook Handling | 🔴 HIGH | Critical | Medium |
| Concurrency Control | 🔴 HIGH | Critical | Medium |
| Payment Expiration | 🟡 MEDIUM | Important | Low |
| Payment Retry | 🟡 MEDIUM | Important | Medium |
| Refund Support | 🟡 MEDIUM | Important | High |
| Payment History/Audit | 🟡 MEDIUM | Important | Medium |
| Payment Method Availability | 🟡 MEDIUM | Important | Low |
| Payment Notification | 🟡 MEDIUM | Important | Medium |
| Partial Payment | 🟢 LOW | Optional | Medium |

---

## 🎯 Recommended Implementation Order

### Phase 1: Critical Fixes (Must have for MVP)
1. ✅ Idempotency & Duplicate Prevention
2. ✅ Amount Validation
3. ✅ Concurrency Control
4. ✅ Payment Gateway Integration Structure

### Phase 2: Production Ready
5. ✅ Webhook Handling
6. ✅ Payment Expiration
7. ✅ Payment Method Availability Check
8. ✅ Payment Notification

### Phase 3: Advanced Features
9. ✅ Payment Retry Logic
10. ✅ Refund Support
11. ✅ Payment History/Audit Trail
12. ✅ Partial Payment (nếu cần)

---

## 📝 Code Structure Recommendations

### 1. Tách Payment Gateway Logic

```
src/microservices/payment/
├── gateways/
│   ├── payment-gateway.interface.ts
│   ├── payment-gateway.factory.ts
│   ├── vnpay.gateway.ts
│   ├── momo.gateway.ts
│   └── stripe.gateway.ts
├── services/
│   ├── payment.service.ts
│   ├── payment-validation.service.ts
│   └── payment-notification.service.ts
└── ...
```

### 2. Thêm Payment Events (Event-Driven)

```typescript
// Payment Events
export enum PaymentEvent {
  PAYMENT_CREATED = 'payment.created',
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded'
}

// Emit events
@EventPattern(PaymentEvent.PAYMENT_SUCCESS)
async handlePaymentSuccess(payment: Payment) {
  // Update booking status
  // Send notification
  // Trigger ticket issuance
}
```

---

## ✅ Kết luận

Payment Service hiện tại đã có **foundation tốt** nhưng cần **cải thiện nhiều điểm** để đạt chuẩn production:

**Điểm mạnh:**
- ✅ Transaction safety
- ✅ Basic validation
- ✅ Error handling
- ✅ Microservice architecture

**Cần cải thiện ngay:**
- 🔴 Idempotency & duplicate prevention
- 🔴 Amount validation
- 🔴 Payment gateway integration structure
- 🔴 Webhook handling
- 🔴 Concurrency control

**Có thể làm sau:**
- 🟡 Payment expiration
- 🟡 Refund support
- 🟡 Payment retry
- 🟡 Audit trail

**Recommendation:** Implement Phase 1 trước khi deploy production, Phase 2 cho production ready, Phase 3 tùy business requirement.

