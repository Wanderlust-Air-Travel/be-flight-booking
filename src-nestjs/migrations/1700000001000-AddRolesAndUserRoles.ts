import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRolesAndUserRoles1700000001000 implements MigrationInterface {
    name = 'AddRolesAndUserRoles1700000001000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create Roles table
        await queryRunner.query(`
            CREATE TABLE Roles (
                role_code VARCHAR(50) NOT NULL
                    CONSTRAINT PK_Roles PRIMARY KEY,
                name NVARCHAR(100) NOT NULL,
                description NVARCHAR(500) NULL,
                is_active BIT NOT NULL DEFAULT 1
            )
        `);

        // Create UserRoles join table
        await queryRunner.query(`
            CREATE TABLE UserRoles (
                user_id UNIQUEIDENTIFIER NOT NULL,
                role_code VARCHAR(50) NOT NULL,
                CONSTRAINT PK_UserRoles PRIMARY KEY (user_id, role_code),
                CONSTRAINT FK_UserRoles_Users
                    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
                CONSTRAINT FK_UserRoles_Roles
                    FOREIGN KEY (role_code) REFERENCES Roles(role_code) ON DELETE CASCADE
            )
        `);

        // Insert default roles
        // I. Nhóm Người dùng Cuối (End-Users)
        // II. Nhóm Nghiệp vụ Cốt lõi (Core Operations Staff)
        // III. Nhóm Hỗ trợ & Quản trị (Support & Administration)
        await queryRunner.query(`
            INSERT INTO Roles (role_code, name, description, is_active) VALUES
            -- I. Nhóm Người dùng Cuối
            ('CUSTOMER', N'Khách hàng/Hành khách', N'Vai trò mặc định cho tất cả người dùng. Tìm kiếm, đặt vé, thanh toán, quản lý đặt chỗ cá nhân, check-in.', 1),
            ('TRAVEL_AGENT', N'Đại lý Du lịch', N'Đặt chỗ cho nhiều khách hàng, quản lý đặt chỗ nhóm, áp dụng giá đại lý.', 1),
            
            -- II. Nhóm Nghiệp vụ Cốt lõi
            ('SCHEDULE_PLANNER', N'Quản lý Lịch bay', N'Tạo, sửa đổi, hủy bỏ các chuyến bay, định nghĩa đường bay và giờ bay.', 1),
            ('REVENUE_ANALYST', N'Quản lý Giá vé & Doanh thu', N'Thiết lập cấu trúc giá vé, hạng đặt chỗ, điều chỉnh giá và số lượng ghế bán (Yield Management).', 1),
            ('ANCILLARY_MANAGER', N'Quản lý Dịch vụ Phụ trợ', N'Định nghĩa và cấu hình các dịch vụ bổ sung (hành lý, suất ăn, chỗ ngồi ưu tiên) và thiết lập giá bán.', 1),
            ('CALL_CENTER', N'Nhân viên Hỗ trợ/Đặt chỗ', N'Xử lý các giao dịch phức tạp (hoàn tiền, trao đổi vé), hỗ trợ check-in tại quầy.', 1),
            
            -- III. Nhóm Hỗ trợ & Quản trị
            ('ADMIN', N'Quản trị viên Hệ thống', N'Quản lý toàn bộ hệ thống, cấp phát quyền truy cập, đảm bảo bảo mật và hiệu suất hệ thống.', 1),
            ('ACCOUNTING_STAFF', N'Chuyên viên Kế toán/Tài chính', N'Xử lý và đối soát các giao dịch tài chính (hoàn tiền, thanh toán với đại lý), tạo báo cáo tài chính.', 1),
            ('DISTRIBUTION_MANAGER', N'Quản lý Kênh Phân phối', N'Quản lý kết nối và đồng bộ hóa thông tin với các hệ thống phân phối toàn cầu (GDS) và đối tác bán lẻ.', 1),
            ('FRAUD_ANALYST', N'Phân tích An ninh & Gian lận', N'Theo dõi và ngăn chặn các giao dịch đáng ngờ, đảm bảo tuân thủ các quy định bảo mật dữ liệu.', 1),
            
            -- Legacy roles (for backward compatibility)
            ('FARE_MANAGER', N'Quản lý giá vé (Legacy)', N'Legacy role - Sử dụng REVENUE_ANALYST thay thế', 1),
            ('FLIGHT_MANAGER', N'Quản lý chuyến bay (Legacy)', N'Legacy role - Sử dụng SCHEDULE_PLANNER thay thế', 1),
            ('OPERATIONS', N'Vận hành (Legacy)', N'Legacy role - Sử dụng CALL_CENTER thay thế', 1),
            ('SALES', N'Bán hàng (Legacy)', N'Legacy role - Sử dụng TRAVEL_AGENT thay thế', 1)
        `);

        // Assign CUSTOMER role to all existing users
        await queryRunner.query(`
            INSERT INTO UserRoles (user_id, role_code)
            SELECT user_id, 'CUSTOMER'
            FROM Users
            WHERE user_id NOT IN (SELECT user_id FROM UserRoles WHERE role_code = 'CUSTOMER')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS UserRoles');
        await queryRunner.query('DROP TABLE IF EXISTS Roles');
    }
}
