# Shared Enums

Tất cả enum được sử dụng chung giữa API Gateway và Microservices được lưu trữ tại đây để đảm bảo tính nhất quán và tránh trùng lặp.

## Cấu trúc

```
src/shared/constants/enums/
├── payment.enum.ts    # Payment-related enums
├── search.enum.ts     # Search-related enums
├── email.enum.ts      # Email-related enums
├── index.ts           # Export tất cả enums
└── README.md          # This file
```

## Cách sử dụng

### Import enum

```typescript
// Import từ shared location
import { PaymentMethodCode, PaymentStatus } from 'src/shared/constants/enums';
import { TripType, CabinType } from 'src/shared/constants/enums';
import { EmailStatus, EmailTemplate } from 'src/shared/constants/enums';

// Hoặc import tất cả
import { PaymentMethodCode, PaymentStatus, TripType, CabinType, EmailStatus, EmailTemplate } from 'src/shared/constants/enums';
```

### Không được định nghĩa enum trong DTO files

**❌ SAI:**
```typescript
// src/microservices/payment/dto/create-payment.dto.ts
export enum PaymentMethodCode {
  CREDIT_CARD = 'CREDIT_CARD',
  // ...
}
```

**✅ ĐÚNG:**
```typescript
// src/microservices/payment/dto/create-payment.dto.ts
import { PaymentMethodCode } from 'src/shared/constants/enums';

export class CreatePaymentDto {
  @IsEnum(PaymentMethodCode)
  paymentMethodCode: PaymentMethodCode;
}
```

## Danh sách Enums

### Payment Enums (`payment.enum.ts`)

- **PaymentMethodCode**: Phương thức thanh toán
  - `CREDIT_CARD`
  - `DEBIT_CARD`
  - `BANK_TRANSFER`
  - `EWALLET`
  - `CASH`

- **PaymentStatus**: Trạng thái thanh toán
  - `PENDING`
  - `SUCCESS`
  - `FAILED`

### Search Enums (`search.enum.ts`)

- **TripType**: Loại chuyến bay
  - `ONE_WAY`
  - `ROUND_TRIP`

- **CabinType**: Loại cabin
  - `ECONOMY`
  - `BUSINESS`
  - `FIRST`

### Email Enums (`email.enum.ts`)

- **EmailStatus**: Trạng thái email
  - `PENDING`
  - `QUEUED`
  - `SENDING`
  - `SENT`
  - `FAILED`

- **EmailTemplate**: Template email
  - `OTP_PAYMENT`
  - `OTP_PASSWORD_RESET`
  - `PAYMENT_SUCCESS`
  - `PAYMENT_FAILED`
  - `BOOKING_CONFIRMATION`

### Booking Enums (`booking.enum.ts`)

- **PassengerType**: Loại hành khách
  - `ADT` - Adult (Người lớn)
  - `CHD` - Child (Trẻ em)
  - `INF` - Infant (Trẻ sơ sinh)

## Thêm enum mới

1. Tạo file enum mới trong `src/shared/constants/enums/` (ví dụ: `booking.enum.ts`)
2. Export enum từ file mới
3. Thêm export vào `index.ts`:
   ```typescript
   export * from './booking.enum';
   ```
4. Update file này (README.md) để document enum mới
5. Import và sử dụng từ shared location trong tất cả các file cần dùng

## Lưu ý

- **Tất cả enum phải được định nghĩa trong shared location**, không được định nghĩa trong DTO files hoặc service files
- **Import từ shared location** thay vì từ DTO files
- **Không duplicate enum** giữa API Gateway và Microservices
- **Update README này** khi thêm enum mới

