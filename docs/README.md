# Documentation

Tài liệu dự án Flight Booking Backend được tổ chức theo các danh mục sau:

## Mục lục

### [Getting Started](./README.md)
- **[README.md](../README.md)** - Hướng dẫn cài đặt và chạy dự án (ở root)

### [API Documentation](./api/)
- **[API_DOCS.md](./api/API_DOCS.md)** - Tài liệu đầy đủ về tất cả API endpoints
- **[API_FLOW_ANALYSIS.md](./api/API_FLOW_ANALYSIS.md)** - Phân tích flow API và các vấn đề đã được fix

### [Database Documentation](./database/)
- **[SQL-SCRIPTS-GUIDE.md](./database/SQL-SCRIPTS-GUIDE.md)** - Hướng dẫn sử dụng các SQL scripts
- **[TRIGGERS.md](./database/TRIGGERS.md)** - Tài liệu về database triggers
- **[ERD.md](./database/ERD.md)** - Entity Relationship Diagram
- **[SEED-README.md](./database/SEED-README.md)** - Hướng dẫn seed database

### [Setup Guides](./setup/)
- **[REDIS_SETUP.md](./setup/REDIS_SETUP.md)** - Hướng dẫn setup Redis với Docker
- **[WSL-SQL-SERVER-SETUP.md](./setup/WSL-SQL-SERVER-SETUP.md)** - Hướng dẫn kết nối SQL Server từ WSL
- **[QUICK_FIX.md](./setup/QUICK_FIX.md)** - Quick fix cho các lỗi thường gặp

### [Design Documents](./design/)
- **[RESERVATION_DESIGN.md](./design/RESERVATION_DESIGN.md)** - Thiết kế Reservation Microservice

### [Project Documentation](./)
- **[CHANGELOG.md](./CHANGELOG.md)** - Lịch sử thay đổi của dự án
- **[STRUCTURE.md](./STRUCTURE.md)** - Cấu trúc dự án và các module

## Tools

Các công cụ và scripts hỗ trợ được đặt trong thư mục [`../tools/`](../tools/):
- **Flight-Booking-API.postman_collection.json** - Postman collection để test API
- **test-db-connection.js** - Script test kết nối database
- **test-db-connection.sh** - Script test kết nối database (bash)
- **open-firewall-port.ps1** - Script mở firewall port cho SQL Server

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

