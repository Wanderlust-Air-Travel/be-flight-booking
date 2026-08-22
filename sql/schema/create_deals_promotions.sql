/* =========================================================
   MIGRATION: Create Deals and Promotions Tables
   =========================================================
   This migration adds tables for managing deals and promotions
   in the flight booking system.

   Run this script after the initial schema migration.
   ========================================================= */

USE flight_booking_db;
GO

/* =========================================================
   1. DEALS TABLE
   ========================================================= */
CREATE TABLE Deals (
    deal_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Deals PRIMARY KEY,
    title NVARCHAR(500) NOT NULL,
    description NVARCHAR(1000) NULL,
    valid_from DATETIME2 NOT NULL,
    valid_until DATETIME2 NOT NULL,
    discount_pct INT NOT NULL,
    destinations NVARCHAR(500) NULL,  -- JSON array stored as string, e.g. '["HAN", "DAD"]'
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL,

    -- Constraints
    CONSTRAINT CK_Deals_ValidDates
        CHECK (valid_from <= valid_until),
    CONSTRAINT CK_Deals_DiscountPct
        CHECK (discount_pct >= 1 AND discount_pct <= 100),
    CONSTRAINT CK_Deals_Destinations_Format
        CHECK (
            destinations IS NULL
            OR LEN(destinations) > 0
        )
);
GO

CREATE INDEX IX_Deals_IsActive ON Deals(is_active);
CREATE INDEX IX_Deals_ValidDates ON Deals(valid_from, valid_until);
GO

/* =========================================================
   2. PROMOTIONS TABLE
   ========================================================= */
CREATE TABLE Promotions (
    promotion_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Promotions PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description NVARCHAR(1000) NULL,
    valid_until DATETIME2 NOT NULL,
    min_purchase_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    discount_pct INT NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL,

    -- Constraints
    CONSTRAINT CK_Promotions_DiscountPct
        CHECK (discount_pct >= 1 AND discount_pct <= 100),
    CONSTRAINT CK_Promotions_MinPurchase
        CHECK (min_purchase_amount >= 0),
    CONSTRAINT CK_Promotions_Currency
        CHECK (LEN(currency) = 3)
);
GO

CREATE UNIQUE INDEX IX_Promotions_Code ON Promotions(code);
CREATE INDEX IX_Promotions_IsActive ON Promotions(is_active);
CREATE INDEX IX_Promotions_ValidUntil ON Promotions(valid_until);
GO

/* =========================================================
   3. SEED DATA (Optional - for testing)
   ========================================================= */
-- Insert sample deals
INSERT INTO Deals (deal_id, title, description, valid_from, valid_until, discount_pct, destinations, is_active)
VALUES
    (NEWID(), N'Hà Nội ↔ Đà Nẵng — Giảm 20%', N'Khuyến mãi đặc biệt cho chuyến bay một chiều Hà Nội – Đà Nẵng.',
        '2026-08-01T00:00:00Z', '2026-12-31T23:59:59Z', 20, '["HAN", "DAD"]', 1),
    (NEWID(), N'TP.HCM ↔ Cam Ranh — Giảm 15%', N'Ưu đãi hè cho đường bay TP.HCM – Cam Ranh.',
        '2026-08-01T00:00:00Z', '2026-10-31T23:59:59Z', 15, '["SGN", "CXR"]', 1);

-- Insert sample promotions
INSERT INTO Promotions (promotion_id, code, description, valid_until, min_purchase_amount, currency, discount_pct, is_active)
VALUES
    (NEWID(), 'WELCOME10', N'Giảm 10% cho lần đặt vé đầu tiên.',
        '2026-12-31T23:59:59Z', 1000000, 'VND', 10, 1),
    (NEWID(), 'SUMMER15', N'Giảm 15% trong mùa hè 2026.',
        '2026-09-30T23:59:59Z', 2000000, 'VND', 15, 1);
GO

PRINT 'Migration completed: Deals and Promotions tables created successfully.';
GO
