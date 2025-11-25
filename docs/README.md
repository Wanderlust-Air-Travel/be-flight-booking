# Tài liệu dự án

Tài liệu dự án Flight Booking Backend được tổ chức theo các danh mục sau.

## Tài liệu chính

### Bắt đầu
- **[README.md](../README.md)** - Hướng dẫn cài đặt và chạy dự án (ở root)

### API
- **[API_DOCS.md](./api/API_DOCS.md)** - Tài liệu về tất cả API endpoints
- **[API_TESTING_FLOW.md](./api/API_TESTING_FLOW.md)** - Hướng dẫn test API theo từng bước
- **[EMAIL_SERVICE_OTP_TESTING.md](./EMAIL_SERVICE_OTP_TESTING.md)** - Hướng dẫn test Email và OTP

### Dự án
- **[CHANGELOG.md](./CHANGELOG.md)** - Lịch sử thay đổi của dự án
- **[STRUCTURE.md](./STRUCTURE.md)** - Cấu trúc dự án và cách hệ thống hoạt động

### Database
- **[ERD.md](./database/ERD.md)** - Sơ đồ cơ sở dữ liệu
- **[SEED-README.md](./database/SEED-README.md)** - Hướng dẫn tạo dữ liệu mẫu
- **[DOCKER_INITIALIZATION.md](./database/DOCKER_INITIALIZATION.md)** - Chi tiết về flow khởi tạo database trong Docker

### Cài đặt
- **[REDIS_SETUP.md](./setup/REDIS_SETUP.md)** - Hướng dẫn cài đặt Redis
- **[DEALS_IMAGES_SETUP.md](./setup/DEALS_IMAGES_SETUP.md)** - Hướng dẫn quản lý ảnh

## Công cụ hỗ trợ

Các công cụ và scripts hỗ trợ:

**Postman Collection:**
- `tools/Flight-Booking-API.postman_collection.json` - File Postman để test API

**Scripts hữu ích:**
```bash
# Kiểm tra kết nối database
npm run test:db

# Kiểm tra dịch vụ email
npm run test:email

# Tải ảnh cho deals
npm run download:deals-images
```

## Cấu trúc thư mục

```
docs/
├── api/                    # API documentation
├── database/               # Database documentation
├── setup/                  # Setup guides
├── design/                 # Design documents
├── CHANGELOG.md           # Project changelog
├── STRUCTURE.md           # Project structure
└── README.md              # This file

tools/                      # Utility scripts and tools
sql/                        # SQL scripts
src/                        # Source code
```

