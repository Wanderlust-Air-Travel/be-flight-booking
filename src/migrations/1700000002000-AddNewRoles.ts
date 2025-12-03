import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to add new professional roles to the system
 * This migration adds roles based on real-world Flight Booking System requirements
 * Legacy roles are kept for backward compatibility
 */
export class AddNewRoles1700000002000 implements MigrationInterface {
    name = 'AddNewRoles1700000002000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new professional roles
        // Only insert if they don't already exist
        await queryRunner.query(`
            -- I. Nhóm Người dùng Cuối (End-Users)
            IF NOT EXISTS (SELECT 1 FROM Roles WHERE role_code = 'TRAVEL_AGENT')
            INSERT INTO Roles (role_code, name, description, is_active) VALUES
            ('TRAVEL_AGENT', N'Đại lý Du lịch', N'Đặt chỗ cho nhiều khách hàng, quản lý đặt chỗ nhóm, áp dụng giá đại lý.', 1);
            
            -- II. Nhóm Nghiệp vụ Cốt lõi (Core Operations Staff)
            IF NOT EXISTS (SELECT 1 FROM Roles WHERE role_code = 'SCHEDULE_PLANNER')
            INSERT INTO Roles (role_code, name, description, is_active) VALUES
            ('SCHEDULE_PLANNER', N'Quản lý Lịch bay', N'Tạo, sửa đổi, hủy bỏ các chuyến bay, định nghĩa đường bay và giờ bay.', 1);
            
            IF NOT EXISTS (SELECT 1 FROM Roles WHERE role_code = 'REVENUE_ANALYST')
            INSERT INTO Roles (role_code, name, description, is_active) VALUES
            ('REVENUE_ANALYST', N'Quản lý Giá vé & Doanh thu', N'Thiết lập cấu trúc giá vé, hạng đặt chỗ, điều chỉnh giá và số lượng ghế bán (Yield Management).', 1);
            
            IF NOT EXISTS (SELECT 1 FROM Roles WHERE role_code = 'ANCILLARY_MANAGER')
            INSERT INTO Roles (role_code, name, description, is_active) VALUES
            ('ANCILLARY_MANAGER', N'Quản lý Dịch vụ Phụ trợ', N'Định nghĩa và cấu hình các dịch vụ bổ sung (hành lý, suất ăn, chỗ ngồi ưu tiên) và thiết lập giá bán.', 1);
            
            IF NOT EXISTS (SELECT 1 FROM Roles WHERE role_code = 'CALL_CENTER')
            INSERT INTO Roles (role_code, name, description, is_active) VALUES
            ('CALL_CENTER', N'Nhân viên Hỗ trợ/Đặt chỗ', N'Xử lý các giao dịch phức tạp (hoàn tiền, trao đổi vé), hỗ trợ check-in tại quầy.', 1);
            
            -- III. Nhóm Hỗ trợ & Quản trị (Support & Administration)
            IF NOT EXISTS (SELECT 1 FROM Roles WHERE role_code = 'ACCOUNTING_STAFF')
            INSERT INTO Roles (role_code, name, description, is_active) VALUES
            ('ACCOUNTING_STAFF', N'Chuyên viên Kế toán/Tài chính', N'Xử lý và đối soát các giao dịch tài chính (hoàn tiền, thanh toán với đại lý), tạo báo cáo tài chính.', 1);
            
            IF NOT EXISTS (SELECT 1 FROM Roles WHERE role_code = 'DISTRIBUTION_MANAGER')
            INSERT INTO Roles (role_code, name, description, is_active) VALUES
            ('DISTRIBUTION_MANAGER', N'Quản lý Kênh Phân phối', N'Quản lý kết nối và đồng bộ hóa thông tin với các hệ thống phân phối toàn cầu (GDS) và đối tác bán lẻ.', 1);
            
            IF NOT EXISTS (SELECT 1 FROM Roles WHERE role_code = 'FRAUD_ANALYST')
            INSERT INTO Roles (role_code, name, description, is_active) VALUES
            ('FRAUD_ANALYST', N'Phân tích An ninh & Gian lận', N'Theo dõi và ngăn chặn các giao dịch đáng ngờ, đảm bảo tuân thủ các quy định bảo mật dữ liệu.', 1);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove new roles (but keep legacy roles for backward compatibility)
        await queryRunner.query(`
            DELETE FROM UserRoles WHERE role_code IN (
                'TRAVEL_AGENT', 'SCHEDULE_PLANNER', 'REVENUE_ANALYST', 
                'ANCILLARY_MANAGER', 'CALL_CENTER', 'ACCOUNTING_STAFF', 
                'DISTRIBUTION_MANAGER', 'FRAUD_ANALYST'
            );
            
            DELETE FROM Roles WHERE role_code IN (
                'TRAVEL_AGENT', 'SCHEDULE_PLANNER', 'REVENUE_ANALYST', 
                'ANCILLARY_MANAGER', 'CALL_CENTER', 'ACCOUNTING_STAFF', 
                'DISTRIBUTION_MANAGER', 'FRAUD_ANALYST'
            );
        `);
    }
}

