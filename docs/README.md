# Documentation

Tài liệu dự án Flight Booking Backend được tổ chức theo các danh mục sau:

## Mục lục

### [Getting Started](./README.md)
- **[README.md](../README.md)** - Hướng dẫn cài đặt và chạy dự án (ở root)

### [API Documentation](./api/)
- **[API_DOCS.md](./api/API_DOCS.md)** - Tài liệu đầy đủ về tất cả API endpoints
- **[API_SEQUENCE_DIAGRAMS.md](./api/API_SEQUENCE_DIAGRAMS.md)** - Sequence diagrams mô tả flow xử lý của toàn bộ hệ thống
- **[API_TESTING_FLOW.md](./api/API_TESTING_FLOW.md)** - Hướng dẫn test API theo flow từng bước
- **[CHANGELOG_API_DOCS.md](./api/CHANGELOG_API_DOCS.md)** - Lịch sử thay đổi API documentation

### [Database Documentation](./database/)
- **[SQL-SCRIPTS-GUIDE.md](./database/SQL-SCRIPTS-GUIDE.md)** - Hướng dẫn sử dụng các SQL scripts
- **[TRIGGERS.md](./database/TRIGGERS.md)** - Tài liệu về database triggers
- **[ERD.md](./database/ERD.md)** - Entity Relationship Diagram
- **[SEED-README.md](./database/SEED-README.md)** - Hướng dẫn seed database

### [Setup Guides](./setup/)
- **[REDIS_SETUP.md](./setup/REDIS_SETUP.md)** - Hướng dẫn setup Redis với Docker
- **[WSL-SQL-SERVER-SETUP.md](./setup/WSL-SQL-SERVER-SETUP.md)** - Hướng dẫn kết nối SQL Server từ WSL
- **[SSMS_CONNECT_DOCKER.md](./setup/SSMS_CONNECT_DOCKER.md)** - Hướng dẫn kết nối SQL Server từ SSMS (Docker)

### [Design Documents](./design/)
- **[RESERVATION_STORAGE_ANALYSIS.md](./design/RESERVATION_STORAGE_ANALYSIS.md)** - Phân tích và thiết kế Reservation Storage (Hybrid Approach: Database + Redis)
- **[BACKEND_STATE_MANAGEMENT_ANALYSIS.md](./design/BACKEND_STATE_MANAGEMENT_ANALYSIS.md)** - Phân tích Backend State Management & Best Practices
- **[JWT_MICROSERVICES_PATTERN.md](./design/JWT_MICROSERVICES_PATTERN.md)** - JWT Authentication Pattern trong Microservices
- **[JWT_IMPLEMENTATION_SUMMARY.md](./design/JWT_IMPLEMENTATION_SUMMARY.md)** - Tóm tắt Implementation JWT Pattern
- **[PASSENGER_REUSE_BEST_PRACTICE.md](./design/PASSENGER_REUSE_BEST_PRACTICE.md)** - Best Practice cho Passenger Reuse
- **[RESERVATION_EXPIRATION_VALIDATION.md](./design/RESERVATION_EXPIRATION_VALIDATION.md)** - Best Practice cho Reservation Expiration Validation
- **[PAYMENT_SERVICE_ANALYSIS.md](./design/PAYMENT_SERVICE_ANALYSIS.md)** - Phân tích Payment Service và Phase 1 & 2 improvements (Production Ready)
- **[PAYMENT_GATEWAY_EXPLANATION.md](./design/PAYMENT_GATEWAY_EXPLANATION.md)** - Giải thích Payment Gateway Architecture và cách implement real payment gateways

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

