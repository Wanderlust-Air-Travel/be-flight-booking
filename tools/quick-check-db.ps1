# Quick check database connection for E2E tests
# Usage: .\tools\quick-check-db.ps1

Write-Host "🔍 Quick Database Connection Check" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".\.env")) {
    Write-Host "❌ File .env không tồn tại!" -ForegroundColor Red
    Write-Host "   Tạo file .env từ env.example" -ForegroundColor Yellow
    exit 1
}

# Check SQL Server container
Write-Host "📦 Kiểm tra SQL Server container..." -ForegroundColor Cyan
$container = docker ps --filter "name=sqlserver" --format "{{.Names}}"
if (-not $container) {
    Write-Host "❌ SQL Server container chưa chạy!" -ForegroundColor Red
    Write-Host "   Chạy: docker-compose -f docker-compose-full-services.yml up -d sqlserver" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ SQL Server container đang chạy: $container" -ForegroundColor Green
}

# Check container health
$health = docker inspect sqlserver --format='{{.State.Health.Status}}' 2>$null
if ($health -eq "healthy") {
    Write-Host "✅ Container healthy" -ForegroundColor Green
} else {
    Write-Host "⚠️  Container status: $health" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔧 Test kết nối database..." -ForegroundColor Cyan

# Load .env and test connection
$env:DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$env:DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "1434" }

# Run test connection script
npm run test:db

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Database connection OK! Có thể chạy E2E tests" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Database connection failed!" -ForegroundColor Red
    Write-Host "   Xem docs/test-db-connection-fix.md để fix" -ForegroundColor Yellow
    exit 1
}

