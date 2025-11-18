# Passenger Reuse Best Practice

## Tổng quan

Hệ thống tự động tái sử dụng thông tin passenger dựa trên `documentNumber` và `userId` để:
- Tránh duplicate data
- Cải thiện UX
- Đảm bảo data consistency

## Logic hiện tại

### Option 1: Sử dụng passenger đã có
1. User gửi request với `passengerId`
2. Backend tìm passenger theo `passengerId`
3. Validate passenger thuộc về user hiện tại
4. Sử dụng passenger đó

### Option 2: Tạo passenger mới
1. User gửi request với thông tin passenger mới (không có `passengerId`)
2. Backend kiểm tra xem đã có passenger với cùng `documentNumber` + `userId` chưa
3. Nếu có: Validate thông tin (`fullname`, `dob`, `gender`) → Tái sử dụng (log warning nếu không khớp)
4. Nếu không có: Tạo passenger mới

**Code location:** `src/microservices/booking/booking.service.ts`

## Best Practice Implementation

**Đã implement:**
1. Validation thông tin khớp - So sánh fullname, dob, gender
2. Logging - Log info/warning cho audit trail
3. Security - Chỉ tái sử dụng passenger của cùng user

## Trade-offs

**Thông tin không khớp:**
- Log warning để admin review
- Vẫn cho phép booking (tránh block user hợp lệ)
- Sử dụng passenger record cũ (giữ nguyên data gốc)

**Document Number uniqueness:**
- Check `documentNumber` + `userId` (scope trong user)
- Không enforce global uniqueness (hợp lệ)

**Data Privacy & GDPR:**
- Chỉ lưu thông tin cần thiết
- User có quyền xem/sửa/xóa passengers của mình
- Cần implement data retention policy

## Conclusion

**Tái sử dụng passenger dựa trên `documentNumber` là best practice** vì tránh duplicate, cải thiện UX, đảm bảo data consistency, tuân thủ industry standards.