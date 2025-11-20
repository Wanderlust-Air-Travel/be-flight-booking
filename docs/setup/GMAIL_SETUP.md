# Gmail API Authentication Setup Guide

Hướng dẫn chi tiết để setup Gmail API authentication cho Email Service.

## Bước 1: Tạo Google Cloud Project và OAuth 2.0 Credentials

### 1.1. Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo một project mới hoặc chọn project hiện có
3. Ghi nhớ **Project ID**

### 1.2. Enable Gmail API

1. Trong Google Cloud Console, vào **APIs & Services** > **Library**
2. Tìm kiếm "Gmail API"
3. Click **Enable** để kích hoạt Gmail API cho project

### 1.3. Tạo OAuth 2.0 Credentials

1. Vào **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Nếu chưa có OAuth consent screen, bạn sẽ được yêu cầu cấu hình:
   - **User Type**: Chọn "External" (cho development) hoặc "Internal" (cho G Suite)
   - **App name**: Nhập tên ứng dụng (ví dụ: "Flight Booking Email Service")
   - **User support email**: Email hỗ trợ
   - **Developer contact information**: Email của developer
   - **Scopes**: Thêm scope `https://www.googleapis.com/auth/gmail.send`
   - **Test users**: Thêm email Gmail của bạn (nếu chọn External)

4. Sau khi cấu hình OAuth consent screen, quay lại tạo OAuth client ID:
   - **Application type**: Chọn **"Desktop app"** (cho development) hoặc **"Web application"** (cho production)
   - **Name**: Đặt tên cho credentials (ví dụ: "Flight Booking Desktop Client")
   - Click **Create**

5. Download credentials file:
   - Click vào credentials vừa tạo
   - Click **Download JSON**
   - Lưu file với tên `credentials_desktop_apps.json` (hoặc `credentials_web_apps.json` nếu chọn Web application)
   - Đặt file vào **root directory** của project (cùng cấp với `package.json`)

## Bước 2: Cấu hình Environment Variables

Thêm các biến môi trường vào file `.env`:

```env
# Gmail API Configuration
GMAIL_CREDENTIALS_PATH=./credentials_desktop_apps.json
GMAIL_TOKEN_PATH=./token.json
GMAIL_FROM_EMAIL=your-email@gmail.com  # Email Gmail của bạn
EMAIL_MAX_RETRIES=3
```

**Lưu ý:**
- `GMAIL_CREDENTIALS_PATH`: Đường dẫn đến file credentials JSON (mặc định: `./credentials_desktop_apps.json`)
- `GMAIL_TOKEN_PATH`: Đường dẫn để lưu token sau khi authenticate (mặc định: `./token.json`)
- `GMAIL_FROM_EMAIL`: Email Gmail sẽ được dùng để gửi email (có thể dùng `me` để dùng email của account đã authenticate)

## Bước 3: Authenticate Gmail API

### Cách 1: Sử dụng Script Helper (Khuyến nghị)

Chạy script helper để authenticate:

```bash
npm run gmail:auth
```

Script sẽ:
1. Đọc file credentials
2. Tạo authorization URL
3. Mở browser để bạn authorize
4. Lấy authorization code từ URL
5. Exchange code để lấy tokens
6. Lưu tokens vào `token.json`

### Cách 2: Authenticate Thủ Công

1. **Tạo script authenticate** (nếu chưa có):

Tạo file `scripts/gmail-auth.ts`:

```typescript
import { google } from 'googleapis';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';

const credentialsPath = resolve(process.cwd(), 'credentials_desktop_apps.json');
const tokenPath = resolve(process.cwd(), 'token.json');

async function authenticate() {
  try {
    // Load credentials
    const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

    // Create OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Get authorization URL
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.send'],
      prompt: 'consent',
    });

    console.log('Authorize this app by visiting this url:', authUrl);
    console.log('\nAfter authorization, you will be redirected to a URL.');
    console.log('Copy the "code" parameter from the URL and paste it below:\n');

    // Get authorization code from user
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Enter the code from that page here: ', async (code) => {
      rl.close();

      try {
        // Exchange code for tokens
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Save tokens to file
        writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
        console.log(`\n✅ Tokens saved to ${tokenPath}`);
        console.log('✅ Gmail authentication completed successfully!');
      } catch (error: any) {
        console.error('❌ Error while trying to retrieve access token', error);
        process.exit(1);
      }
    });
  } catch (error: any) {
    console.error('❌ Error loading credentials:', error.message);
    console.error('Make sure you have placed credentials_desktop_apps.json in the root directory.');
    process.exit(1);
  }
}

authenticate();
```

2. **Chạy script**:

```bash
npx ts-node scripts/gmail-auth.ts
```

3. **Làm theo hướng dẫn**:
   - Copy URL được hiển thị và mở trong browser
   - Đăng nhập Gmail và authorize ứng dụng
   - Copy authorization code từ URL redirect
   - Paste code vào terminal
   - Tokens sẽ được lưu vào `token.json`

## Bước 4: Kiểm tra Authentication

1. **Kiểm tra health check**:

```bash
curl http://localhost:3000/emails/health
```

Response sẽ có `gmailReady: true` nếu authentication thành công:

```json
{
  "status": "ok",
  "gmailReady": true,
  "queueStats": {
    "total": 0,
    "queued": 0,
    "sending": 0,
    "sent": 0,
    "failed": 0,
    "rateLimitRemaining": 100
  }
}
```

2. **Test gửi email** (sau khi đã có JWT token):

```bash
curl -X POST http://localhost:3000/emails/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Test Email",
    "htmlBody": "<h1>Hello World</h1><p>This is a test email.</p>"
  }'
```

## Troubleshooting

### Lỗi: "Gmail client not initialized. Please authenticate first."

**Nguyên nhân:**
- File `token.json` không tồn tại hoặc không hợp lệ
- File `credentials_desktop_apps.json` không tồn tại hoặc không hợp lệ

**Giải pháp:**
1. Kiểm tra file `credentials_desktop_apps.json` có tồn tại trong root directory
2. Chạy lại authentication script
3. Kiểm tra file `token.json` đã được tạo và có nội dung hợp lệ

### Lỗi: "Invalid credentials"

**Nguyên nhân:**
- Credentials file không đúng format
- OAuth client ID/secret không hợp lệ

**Giải pháp:**
1. Tải lại credentials từ Google Cloud Console
2. Đảm bảo file JSON có format đúng (có `installed` hoặc `web` key)
3. Kiểm tra OAuth client ID/secret trong Google Cloud Console

### Lỗi: "Token expired"

**Nguyên nhân:**
- Access token đã hết hạn
- Refresh token không hợp lệ

**Giải pháp:**
1. Xóa file `token.json`
2. Chạy lại authentication script
3. Đảm bảo chọn `access_type: 'offline'` và `prompt: 'consent'` để nhận refresh token

### Lỗi: "Access blocked: This app's request is invalid"

**Nguyên nhân:**
- OAuth consent screen chưa được publish (cho External apps)
- App đang ở chế độ Testing và user chưa được thêm vào Test users

**Giải pháp:**
1. Vào Google Cloud Console > APIs & Services > OAuth consent screen
2. Thêm email của bạn vào **Test users** (nếu app ở chế độ Testing)
3. Hoặc publish app (cho production)

## Security Best Practices

1. **Không commit credentials và tokens vào Git**:
   - Thêm vào `.gitignore`:
     ```
     credentials_*.json
     token.json
     ```

2. **Sử dụng environment variables cho production**:
   - Lưu credentials trong secure storage (AWS Secrets Manager, Azure Key Vault, etc.)
   - Không hardcode credentials trong code

3. **Rotate credentials định kỳ**:
   - Tạo OAuth client ID mới định kỳ
   - Revoke old credentials khi không còn sử dụng

4. **Giới hạn scopes**:
   - Chỉ request scopes cần thiết (`gmail.send` thay vì `gmail.modify`)

## Production Setup

Cho production, nên sử dụng:

1. **Service Account** (nếu có G Suite/Google Workspace):
   - Tạo Service Account trong Google Cloud Console
   - Enable Domain-wide Delegation
   - Sử dụng Service Account credentials thay vì OAuth 2.0

2. **Web Application OAuth** (cho public apps):
   - Tạo OAuth client ID với type "Web application"
   - Cấu hình authorized redirect URIs
   - Sử dụng server-side OAuth flow

3. **Environment-specific credentials**:
   - Development: `credentials_desktop_apps.json`
   - Production: Lưu trong secure storage và load từ environment variables

## References

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Node.js Google APIs Client Library](https://github.com/googleapis/google-api-nodejs-client)

