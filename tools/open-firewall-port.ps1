# Script to open Windows Firewall port 1433 for WSL
# MUST RUN AS ADMINISTRATOR

Write-Host "Opening Windows Firewall port 1433 for WSL..." -ForegroundColor Cyan

try {
    # Remove existing rule if exists
    $existingRule = Get-NetFirewallRule -DisplayName "SQL Server 1433 WSL" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Remove-NetFirewallRule -DisplayName "SQL Server 1433 WSL" -ErrorAction SilentlyContinue
        Write-Host "Removed existing rule" -ForegroundColor Yellow
    }

    # Create new firewall rule (include Public profile for WSL)
    New-NetFirewallRule -DisplayName "SQL Server 1433 WSL" `
        -Direction Inbound `
        -LocalPort 1433 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -Description "Allow SQL Server port 1433 from WSL"

    Write-Host "[SUCCESS] Firewall rule created!" -ForegroundColor Green
    Write-Host "Port 1433 is now open for WSL connections" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Failed to create firewall rule" -ForegroundColor Red
    Write-Host "Make sure you run this script as Administrator!" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

