/**
 * System Roles
 * Defines all available roles in the system
 * Based on real-world Flight Booking System roles
 */
export enum SystemRole {
	// ==================== I. Nhóm Người dùng Cuối (End-Users) ====================
	
	// Customer role (default for all users)
	CUSTOMER = 'CUSTOMER',
	
	// Travel Agent / Booking Agent - Đại lý du lịch
	TRAVEL_AGENT = 'TRAVEL_AGENT',
	
	// ==================== II. Nhóm Nghiệp vụ Cốt lõi (Core Operations Staff) ====================
	
	// Schedule Planner / Scheduler - Quản lý lịch bay
	SCHEDULE_PLANNER = 'SCHEDULE_PLANNER',
	
	// Revenue Analyst / Fare Specialist - Quản lý giá vé & doanh thu
	REVENUE_ANALYST = 'REVENUE_ANALYST',
	
	// Ancillary Product Manager - Quản lý dịch vụ phụ trợ
	ANCILLARY_MANAGER = 'ANCILLARY_MANAGER',
	
	// Call Center / Airport Staff - Nhân viên hỗ trợ/đặt chỗ
	CALL_CENTER = 'CALL_CENTER',
	
	// ==================== III. Nhóm Hỗ trợ & Quản trị (Support & Administration) ====================
	
	// System Administrator - Quản trị viên hệ thống
	ADMIN = 'ADMIN',
	
	// Accounting Staff - Chuyên viên kế toán/tài chính
	ACCOUNTING_STAFF = 'ACCOUNTING_STAFF',
	
	// Distribution Manager / GDS Specialist - Quản lý kênh phân phối
	DISTRIBUTION_MANAGER = 'DISTRIBUTION_MANAGER',
	
	// Fraud Analyst / Security Specialist - Phân tích an ninh & gian lận
	FRAUD_ANALYST = 'FRAUD_ANALYST',
	
	// ==================== Legacy Roles (for backward compatibility) ====================
	
	// Legacy: Fare Manager (mapped to REVENUE_ANALYST)
	FARE_MANAGER = 'FARE_MANAGER',
	
	// Legacy: Flight Manager (mapped to SCHEDULE_PLANNER)
	FLIGHT_MANAGER = 'FLIGHT_MANAGER',
	
	// Legacy: Operations (mapped to CALL_CENTER)
	OPERATIONS = 'OPERATIONS',
	
	// Legacy: Sales (mapped to TRAVEL_AGENT)
	SALES = 'SALES',
}

/**
 * Role permissions mapping
 * Defines what each role can do
 * Based on real-world Flight Booking System permissions
 */
export const ROLE_PERMISSIONS: Record<SystemRole, string[]> = {
	// ==================== I. Nhóm Người dùng Cuối ====================
	
	[SystemRole.CUSTOMER]: [
		'book:create',
		'book:view-own',
		'book:update-own',
		'book:cancel-own',
		'reservation:create',
		'reservation:view-own',
		'check-in:create',
		'payment:create',
		'payment:view-own',
	],
	
	[SystemRole.TRAVEL_AGENT]: [
		// Travel agents can book for multiple customers
		'book:create',
		'book:view-all',
		'book:update-all',
		'book:cancel-all',
		'reservation:create',
		'reservation:view-all',
		'customer:view',
		'report:view-sales',
		'pricing:view-agent', // View agent-specific pricing
	],
	
	// ==================== II. Nhóm Nghiệp vụ Cốt lõi ====================
	
	[SystemRole.SCHEDULE_PLANNER]: [
		// Schedule Planner - Quản lý lịch bay
		'flight-schedule:create',
		'flight-schedule:update',
		'flight-schedule:delete',
		'flight-schedule:view',
		'flight-instance:create',
		'flight-instance:update',
		'flight-instance:delete',
		'flight-instance:view',
		'route:view',
		'aircraft:view',
	],
	
	[SystemRole.REVENUE_ANALYST]: [
		// Revenue Analyst - Quản lý giá vé & doanh thu
		'fare:create',
		'fare:update',
		'fare:delete',
		'fare:view',
		'pricing:update',
		'pricing:view',
		'yield:manage', // Yield management
		'revenue:view',
		'revenue:analyze',
		'report:view-revenue',
	],
	
	[SystemRole.ANCILLARY_MANAGER]: [
		// Ancillary Product Manager - Quản lý dịch vụ phụ trợ
		'ancillary:create',
		'ancillary:update',
		'ancillary:delete',
		'ancillary:view',
		'ancillary:pricing:update',
		'baggage:manage',
		'meal:manage',
		'seat-preference:manage',
	],
	
	[SystemRole.CALL_CENTER]: [
		// Call Center / Airport Staff - Nhân viên hỗ trợ/đặt chỗ
		'booking:view-all',
		'booking:update-all',
		'booking:cancel-all',
		'booking:refund', // Process refunds
		'booking:exchange', // Process exchanges
		'check-in:view-all',
		'check-in:assist',
		'customer:view',
		'customer:update',
		'flight-instance:view',
		'flight-instance:update-status',
		'ticket:reissue',
	],
	
	// ==================== III. Nhóm Hỗ trợ & Quản trị ====================
	
	[SystemRole.ADMIN]: [
		'*', // All permissions - System Administrator
	],
	
	[SystemRole.ACCOUNTING_STAFF]: [
		// Accounting Staff - Chuyên viên kế toán/tài chính
		'booking:view-all',
		'payment:view-all',
		'payment:reconcile',
		'refund:process',
		'refund:view-all',
		'report:view-financial',
		'report:view-accounting',
		'transaction:view-all',
		'transaction:reconcile',
		'agent:settlement', // Settlement with travel agents
	],
	
	[SystemRole.DISTRIBUTION_MANAGER]: [
		// Distribution Manager / GDS Specialist
		'gds:manage',
		'gds:sync',
		'distribution:view',
		'distribution:configure',
		'channel:manage',
		'inventory:sync',
		'fare:view', // View fares for distribution
		'flight-schedule:view', // View schedules for distribution
	],
	
	[SystemRole.FRAUD_ANALYST]: [
		// Fraud Analyst / Security Specialist
		'booking:view-all',
		'payment:view-all',
		'fraud:detect',
		'fraud:investigate',
		'fraud:block',
		'security:monitor',
		'user:view-all',
		'user:block',
		'audit:view',
		'report:view-security',
	],
	
	// ==================== Legacy Roles (for backward compatibility) ====================
	
	[SystemRole.FARE_MANAGER]: [
		// Legacy: Maps to REVENUE_ANALYST permissions
		'fare:create',
		'fare:update',
		'fare:delete',
		'fare:view',
		'pricing:update',
	],
	
	[SystemRole.FLIGHT_MANAGER]: [
		// Legacy: Maps to SCHEDULE_PLANNER permissions
		'flight-schedule:create',
		'flight-schedule:update',
		'flight-schedule:delete',
		'flight-schedule:view',
		'flight-instance:create',
		'flight-instance:update',
		'flight-instance:delete',
		'flight-instance:view',
	],
	
	[SystemRole.OPERATIONS]: [
		// Legacy: Maps to CALL_CENTER permissions
		'flight-instance:view',
		'flight-instance:update-status',
		'booking:view',
		'booking:view-all',
	],
	
	[SystemRole.SALES]: [
		// Legacy: Maps to TRAVEL_AGENT permissions
		'booking:view',
		'booking:view-all',
		'report:view',
	],
};

