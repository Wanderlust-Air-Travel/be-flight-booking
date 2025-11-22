# PowerShell script to test sending OTP email
# This script will register/login a test user and send OTP email

$API_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3000" }
$TEST_EMAIL = if ($env:TEST_EMAIL) { $env:TEST_EMAIL } else { "test-otp-$(Get-Random -Minimum 1000 -Maximum 9999)@example.com" }
$TEST_PASSWORD = if ($env:TEST_PASSWORD) { $env:TEST_PASSWORD } else { "TestPass123!" }

Write-Host "Testing OTP Email Sending" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host ""

# Step 1: Register a test user
Write-Host "Step 1: Registering test user..." -ForegroundColor Blue
Write-Host "   Email: $TEST_EMAIL" -ForegroundColor Gray

$registerBody = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
    fullname = "Test User"
    phone = "+84901234567"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$API_URL/api/v1/auth/register" `
        -Method Post `
        -Body $registerBody `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Host "[OK] User registered successfully!" -ForegroundColor Green
    # Response might have accessToken directly or in nested structure
    $accessToken = if ($registerResponse.accessToken) { $registerResponse.accessToken } 
                   elseif ($registerResponse.access_token) { $registerResponse.access_token }
                   else { $null }
    Write-Host "   Got access token: $($null -ne $accessToken)" -ForegroundColor Green
    if ($null -eq $accessToken) {
        Write-Host "   Response structure: $($registerResponse | ConvertTo-Json)" -ForegroundColor Yellow
    }
} catch {
    # User might already exist, try to login
    Write-Host "[WARN] Registration failed, trying to login..." -ForegroundColor Yellow
    
    $loginBody = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
    } | ConvertTo-Json
    
    try {
        $loginResponse = Invoke-RestMethod -Uri "$API_URL/api/v1/auth/login" `
            -Method Post `
            -Body $loginBody `
            -ContentType "application/json" `
            -ErrorAction Stop
        
        Write-Host "[OK] Login successful!" -ForegroundColor Green
        $accessToken = if ($loginResponse.accessToken) { $loginResponse.accessToken } 
                       elseif ($loginResponse.access_token) { $loginResponse.access_token }
                       else { $null }
        if ($null -eq $accessToken) {
            Write-Host "   Response structure: $($loginResponse | ConvertTo-Json)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[ERROR] Failed to register or login: $_" -ForegroundColor Red
        exit 1
    }
}

if ($null -eq $accessToken) {
    Write-Host "[ERROR] No access token obtained!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Sending OTP Payment Email..." -ForegroundColor Blue

# Generate random OTP
$otp = Get-Random -Minimum 100000 -Maximum 999999

$emailBody = @{
    to = $TEST_EMAIL
    template = "otp_payment"
    templateData = @{
        otp = $otp.ToString()
        expiresIn = "15 minutes"
    }
} | ConvertTo-Json -Depth 10

try {
    $headers = @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    }
    
    $emailResponse = Invoke-RestMethod -Uri "$API_URL/api/v1/emails/send" `
        -Method Post `
        -Body $emailBody `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "OTP Email sent successfully!" -ForegroundColor Green
    Write-Host "   Email ID: $($emailResponse.emailId)" -ForegroundColor Green
    Write-Host "   Status: $($emailResponse.status)" -ForegroundColor Green
    Write-Host "   OTP Code: $otp" -ForegroundColor Yellow
    Write-Host "   To: $TEST_EMAIL" -ForegroundColor Gray
    
    # Wait a bit and check status
    Write-Host ""
    Write-Host "Step 3: Checking email status..." -ForegroundColor Blue
    Start-Sleep -Seconds 2
    
    try {
        $statusResponse = Invoke-RestMethod -Uri "$API_URL/api/v1/emails/$($emailResponse.emailId)/status" `
            -Method Get `
            -Headers $headers `
            -ErrorAction Stop
        
        Write-Host "Email Status:" -ForegroundColor Green
        Write-Host "   Status: $($statusResponse.status)" -ForegroundColor Green
        Write-Host "   To: $($statusResponse.to)" -ForegroundColor Gray
        if ($statusResponse.sentAt) {
            Write-Host "   Sent At: $($statusResponse.sentAt)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "Could not get email status: $_" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Failed to send OTP email: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "✨ Test completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Tip: Check your email inbox ($TEST_EMAIL) for the OTP code!" -ForegroundColor Yellow

