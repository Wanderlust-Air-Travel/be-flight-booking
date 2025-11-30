# Messages System

## Tổng quan

Hệ thống messages tập trung cho toàn bộ Backend, tuân theo nguyên tắc **Single Source of Truth**. Tất cả messages (success, error, validation) được quản lý tại một nơi, dễ dàng bảo trì và cập nhật.

## Cấu trúc

Messages được phân loại theo **domain** (Auth, Booking, Payment, Search, Reservation) và **loại** (SUCCESS, ERROR, VALIDATION):

```
src/shared/constants/messages/
├── auth.messages.ts          # Authentication messages
├── booking.messages.ts       # Booking messages
├── payment.messages.ts        # Payment messages
├── search.messages.ts         # Search flights messages
├── reservation.messages.ts    # Reservation messages
├── common.messages.ts         # Common messages (không thuộc domain cụ thể)
└── index.ts                   # Export tất cả messages
```

## Cách sử dụng

### 1. Import messages

```typescript
import { AUTH_MESSAGES, BOOKING_MESSAGES, COMMON_MESSAGES } from 'src/shared/constants/messages';
```

### 2. Sử dụng trong Services

```typescript
// ✅ ĐÚNG - Sử dụng messages từ file tập trung
throw new ConflictException(AUTH_MESSAGES.ERROR.EMAIL_ALREADY_EXISTS);
return { success: true, message: AUTH_MESSAGES.SUCCESS.OTP_SENT };

// ❌ SAI - Không hardcode messages
throw new ConflictException('Email already registered');
return { success: true, message: 'OTP sent successfully' };
```

### 3. Sử dụng trong Controllers

```typescript
@ApiOkResponse({
    description: AUTH_MESSAGES.SUCCESS.LOGIN,
    type: LoginResponse
})
async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
}
```

### 4. Sử dụng trong Exception Filters

```typescript
// Exception filter tự động sử dụng message từ exception
// Không cần thay đổi gì trong filter
```

## Quy tắc

### 1. **KHÔNG** hardcode messages
- ❌ `throw new NotFoundException('User not found')`
- ✅ `throw new NotFoundException(AUTH_MESSAGES.ERROR.USER_NOT_FOUND)`

### 2. **LUÔN** sử dụng messages từ file tập trung
- Tất cả messages phải được định nghĩa trong file messages tương ứng
- Không được viết messages trực tiếp trong code

### 3. **PHÂN LOẠI** messages đúng domain
- Auth messages → `auth.messages.ts`
- Booking messages → `booking.messages.ts`
- Common messages → `common.messages.ts`

### 4. **ĐẶT TÊN** messages rõ ràng, mô tả đúng mục đích
- SUCCESS: Mô tả hành động thành công
- ERROR: Mô tả lỗi cụ thể
- VALIDATION: Mô tả lỗi validation

## Thêm messages mới

### Bước 1: Xác định domain
- Auth? → `auth.messages.ts`
- Booking? → `booking.messages.ts`
- Common? → `common.messages.ts`

### Bước 2: Thêm message vào file tương ứng

```typescript
// auth.messages.ts
export const AUTH_MESSAGES = {
    SUCCESS: {
        // ... existing messages
        NEW_FEATURE: 'Tính năng mới thành công', // Thêm message mới
    },
    ERROR: {
        // ... existing messages
        NEW_ERROR: 'Lỗi mới', // Thêm error mới
    },
} as const;
```

### Bước 3: Sử dụng message trong code

```typescript
return { success: true, message: AUTH_MESSAGES.SUCCESS.NEW_FEATURE };
```

## Type Safety

Messages được định nghĩa với `as const` để đảm bảo type safety:

```typescript
// TypeScript sẽ tự động suggest các message keys
AUTH_MESSAGES.SUCCESS. // ← Autocomplete sẽ hiện danh sách
AUTH_MESSAGES.ERROR.   // ← Autocomplete sẽ hiện danh sách
```

## Lợi ích

1. **Dễ bảo trì**: Tất cả messages ở một nơi, dễ tìm và sửa
2. **Nhất quán**: Đảm bảo messages giống nhau trong toàn bộ hệ thống
3. **Type-safe**: TypeScript hỗ trợ autocomplete và type checking
4. **Dễ đa ngôn ngữ**: Có thể mở rộng để hỗ trợ i18n sau này
5. **Tái sử dụng**: Messages có thể được sử dụng lại ở nhiều nơi

## Ví dụ đầy đủ

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { AUTH_MESSAGES } from 'src/shared/constants/messages';

@Injectable()
export class AuthService {
    async register(data: RegisterDto) {
        const existed = await this.usersRepo.findOne({ where: { email: data.email } });
        if (existed) {
            // ✅ Sử dụng message từ file tập trung
            throw new ConflictException(AUTH_MESSAGES.ERROR.EMAIL_ALREADY_EXISTS);
        }
        
        // ... create user logic
        
        return {
            user: { ... },
            // ✅ Sử dụng success message
            message: AUTH_MESSAGES.SUCCESS.REGISTER
        };
    }
    
    async login(data: LoginDto) {
        const user = await this.usersRepo.findOne({ where: { email: data.email } });
        if (!user) {
            // ✅ Sử dụng error message
            throw new NotFoundException(AUTH_MESSAGES.ERROR.USER_NOT_FOUND);
        }
        
        // ... login logic
        
        return {
            user: { ... },
            message: AUTH_MESSAGES.SUCCESS.LOGIN
        };
    }
}
```

## Migration Guide

Khi refactor code cũ để sử dụng messages:

1. **Tìm** tất cả hardcoded messages trong file
2. **Xác định** domain phù hợp
3. **Thêm** message vào file messages tương ứng (nếu chưa có)
4. **Thay thế** hardcoded message bằng message từ file tập trung
5. **Test** để đảm bảo không có regression

## Best Practices

1. **Đặt tên rõ ràng**: Message key phải mô tả đúng nội dung
2. **Phân loại đúng**: Đặt message vào đúng domain và loại (SUCCESS/ERROR/VALIDATION)
3. **Không trùng lặp**: Kiểm tra xem message đã tồn tại chưa trước khi thêm mới
4. **Cập nhật tài liệu**: Khi thêm message mới, cập nhật README này nếu cần

