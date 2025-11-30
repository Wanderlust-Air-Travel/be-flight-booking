# Validation Guide

## Tổng quan

Hệ thống validation được thiết kế để đảm bảo **nhất quán giữa Frontend và Backend**, sử dụng **messages tập trung** và tuân thủ **best practices** của enterprise.

## Cấu trúc Validation

### Backend (NestJS)

#### 1. Custom Validators
- `IsUUIDv7` - Validate UUID v7 format
- `IsVietnamesePhone` - Validate Vietnamese phone numbers
- `IsStrongPassword` - Validate strong password (uppercase, lowercase, number, special char, 6-20 chars)

**Location:** `src/shared/validators/`

#### 2. Validation Messages
Tất cả validation messages được quản lý tập trung trong:
- `src/shared/constants/messages/auth.messages.ts`
- `src/shared/constants/messages/booking.messages.ts`
- `src/shared/constants/messages/payment.messages.ts`
- `src/shared/constants/messages/search.messages.ts`
- `src/shared/constants/messages/reservation.messages.ts`
- `src/shared/constants/messages/common.messages.ts`

#### 3. DTOs với Validation
Tất cả DTOs sử dụng `class-validator` decorators với messages từ hệ thống tập trung:

```typescript
import { IsEmail, IsNotEmpty, MinLength, MaxLength } from "class-validator";
import { AUTH_MESSAGES } from "src/shared/constants/messages";
import { IsVietnamesePhone } from "src/shared/validators/is-vietnamese-phone.validator";
import { IsStrongPassword } from "src/shared/validators/is-strong-password.validator";

export class RegisterDto {
    @IsEmail({}, { message: AUTH_MESSAGES.VALIDATION.EMAIL_INVALID })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.EMAIL_REQUIRED })
    email: string;

    @IsStrongPassword({ message: AUTH_MESSAGES.VALIDATION.PASSWORD_TOO_WEAK })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.PASSWORD_REQUIRED })
    password: string;

    @IsVietnamesePhone({ message: AUTH_MESSAGES.VALIDATION.PHONE_INVALID })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.PHONE_REQUIRED })
    phone: string;
}
```

### Frontend (Next.js)

#### 1. Validation Schemas (Yup)
Tất cả validation schemas sử dụng Yup và messages từ file tập trung:

**Location:** `booking/lib/validation-messages.ts`

```typescript
import * as Yup from "yup";
import { VALIDATION_MESSAGES, VIETNAMESE_PHONE_REGEX, STRONG_PASSWORD_REGEX } from "@/lib/validation-messages";

export const RegisterSchema = Yup.object().shape({
  email: Yup.string()
    .required(VALIDATION_MESSAGES.AUTH.EMAIL_REQUIRED)
    .email(VALIDATION_MESSAGES.AUTH.EMAIL_INVALID),
  
  password: Yup.string()
    .required(VALIDATION_MESSAGES.AUTH.PASSWORD_REQUIRED)
    .min(6, VALIDATION_MESSAGES.AUTH.PASSWORD_MIN_LENGTH)
    .max(20, VALIDATION_MESSAGES.AUTH.PASSWORD_MAX_LENGTH)
    .matches(STRONG_PASSWORD_REGEX, VALIDATION_MESSAGES.AUTH.PASSWORD_TOO_WEAK),
  
  phone: Yup.string()
    .required(VALIDATION_MESSAGES.AUTH.PHONE_REQUIRED)
    .matches(VIETNAMESE_PHONE_REGEX, VALIDATION_MESSAGES.AUTH.PHONE_INVALID),
});
```

## Quy tắc Validation

### 1. **NHẤT QUÁN giữa FE và BE**
- ✅ FE và BE phải có cùng validation rules
- ✅ FE và BE phải sử dụng cùng messages (đồng bộ nội dung)
- ✅ FE validate trước khi gửi request, BE validate lại để đảm bảo security

### 2. **Sử dụng Messages tập trung**
- ✅ Backend: Sử dụng messages từ `src/shared/constants/messages`
- ✅ Frontend: Sử dụng messages từ `booking/lib/validation-messages.ts`
- ❌ KHÔNG hardcode messages trong code

### 3. **Validation Rules**

#### Email
- **Format:** Valid email format
- **BE:** `@IsEmail()`
- **FE:** `Yup.string().email()`

#### Password
- **Length:** 6-20 characters
- **Requirements:** 
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- **BE:** `@IsStrongPassword()`
- **FE:** `Yup.string().matches(STRONG_PASSWORD_REGEX)`

#### Phone (Vietnamese)
- **Format:** Vietnamese phone number
- **Pattern:** `^(0|84)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-6|8|9]|9[0-4|6-9])[0-9]{7}$`
- **BE:** `@IsVietnamesePhone()`
- **FE:** `Yup.string().matches(VIETNAMESE_PHONE_REGEX)`

#### UUID v7
- **Format:** `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`
- **BE:** `@IsUUIDv7()`
- **FE:** Validate bằng regex hoặc library

#### Fullname
- **Length:** 2-100 characters
- **BE:** `@MinLength(2) @MaxLength(100)`
- **FE:** `Yup.string().min(2).max(100)`

## Validation Flow

### Frontend Validation
1. User nhập dữ liệu vào form
2. Yup schema validate real-time
3. Hiển thị error messages từ `validation-messages.ts`
4. Chỉ submit khi validation pass

### Backend Validation
1. Request đến API Gateway
2. ValidationPipe tự động validate DTO
3. Sử dụng messages từ `src/shared/constants/messages`
4. Trả về error response nếu validation fail

## Best Practices

### 1. **Defense in Depth**
- FE validate để cải thiện UX (immediate feedback)
- BE validate để đảm bảo security (không thể bypass)

### 2. **Consistent Messages**
- Messages giống nhau giữa FE và BE
- Sử dụng messages tập trung để dễ maintain

### 3. **Type Safety**
- TypeScript types cho tất cả DTOs
- Type-safe messages với `as const`

### 4. **Custom Validators**
- Tạo custom validators cho business rules phức tạp
- Reuse validators trong nhiều DTOs

## Ví dụ đầy đủ

### Backend DTO
```typescript
// src/api-gateway/modules/auth/dto/register.dto.ts
import { IsEmail, IsNotEmpty, MinLength, MaxLength, IsString } from "class-validator";
import { IsVietnamesePhone } from "src/shared/validators/is-vietnamese-phone.validator";
import { IsStrongPassword } from "src/shared/validators/is-strong-password.validator";
import { AUTH_MESSAGES } from "src/shared/constants/messages";

export class RegisterDto {
    @IsString({ message: AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED })
    @MinLength(2, { message: AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED })
    @MaxLength(100, { message: AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED })
    fullname: string;

    @IsEmail({}, { message: AUTH_MESSAGES.VALIDATION.EMAIL_INVALID })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.EMAIL_REQUIRED })
    email: string;

    @IsStrongPassword({ message: AUTH_MESSAGES.VALIDATION.PASSWORD_TOO_WEAK })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.PASSWORD_REQUIRED })
    password: string;

    @IsVietnamesePhone({ message: AUTH_MESSAGES.VALIDATION.PHONE_INVALID })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.PHONE_REQUIRED })
    phone: string;
}
```

### Frontend Schema
```typescript
// booking/app/(page)/signup/register.schema.ts
import * as Yup from "yup";
import { VALIDATION_MESSAGES, VIETNAMESE_PHONE_REGEX, STRONG_PASSWORD_REGEX } from "@/lib/validation-messages";

export const RegisterSchema = Yup.object().shape({
  fullname: Yup.string()
    .required(VALIDATION_MESSAGES.AUTH.FULLNAME_REQUIRED)
    .min(2, VALIDATION_MESSAGES.AUTH.FULLNAME_MIN_LENGTH)
    .max(100, VALIDATION_MESSAGES.AUTH.FULLNAME_MAX_LENGTH),
  
  email: Yup.string()
    .required(VALIDATION_MESSAGES.AUTH.EMAIL_REQUIRED)
    .email(VALIDATION_MESSAGES.AUTH.EMAIL_INVALID),

  password: Yup.string()
    .required(VALIDATION_MESSAGES.AUTH.PASSWORD_REQUIRED)
    .min(6, VALIDATION_MESSAGES.AUTH.PASSWORD_MIN_LENGTH)
    .max(20, VALIDATION_MESSAGES.AUTH.PASSWORD_MAX_LENGTH)
    .matches(STRONG_PASSWORD_REGEX, VALIDATION_MESSAGES.AUTH.PASSWORD_TOO_WEAK),

  phone: Yup.string()
    .required(VALIDATION_MESSAGES.AUTH.PHONE_REQUIRED)
    .matches(VIETNAMESE_PHONE_REGEX, VALIDATION_MESSAGES.AUTH.PHONE_INVALID),
});
```

## Checklist Validation

Khi tạo DTO/schema mới, đảm bảo:

- [ ] DTO có đầy đủ validation decorators
- [ ] Sử dụng messages từ hệ thống tập trung
- [ ] FE schema đồng bộ với BE DTO
- [ ] Custom validators được sử dụng khi cần
- [ ] Validation messages nhất quán giữa FE và BE
- [ ] Type-safe với TypeScript
- [ ] Test validation với edge cases

## Lưu ý quan trọng

1. **KHÔNG** hardcode validation messages
2. **LUÔN** validate ở cả FE và BE
3. **ĐỒNG BỘ** validation rules giữa FE và BE
4. **SỬ DỤNG** custom validators cho business rules
5. **CẬP NHẬT** messages tập trung khi thay đổi validation

