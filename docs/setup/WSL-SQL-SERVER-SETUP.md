# Hướng dẫn kết nối SQL Server từ WSL

## Vấn đề
Không thể kết nối đến SQL Server từ WSL với lỗi timeout.

## Giải pháp

### Bước 1: Mở Firewall (BẮT BUỘC)

**Chạy PowerShell với quyền Administrator** (Win + X > Windows PowerShell Admin):

**Cách 1: Dùng script (khuyến nghị)**
```powershell
# Di chuyển đến thư mục chứa script
cd <path-to-project>
.\open-firewall-port.ps1
```

**Cách 2: Chạy lệnh trực tiếp**
```powershell
Remove-NetFirewallRule -DisplayName "SQL Server 1434 WSL" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SQL Server 1434 WSL" -Direction Inbound -LocalPort 1434 -Protocol TCP -Action Allow -Profile Any
```

### Bước 2: Lấy IP Windows host và test kết nối

**Trong WSL terminal:**

Lấy IP Windows host:
```bash
cat /etc/resolv.conf | grep nameserver | awk '{print $2}'
```

Test kết nối port 1434:
```bash
# Dùng script test (khuyến nghị)
./test-db-connection.sh

# Hoặc test nhanh (thay <WINDOWS_IP> bằng IP vừa lấy được)
WINDOWS_IP=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}')
timeout 5 bash -c "</dev/tcp/$WINDOWS_IP/1434" && echo "Port OPEN" || echo "Port CLOSED"
```

### Bước 3: Cập nhật .env

Lấy IP Windows host (nếu chưa lấy ở bước 2):
```bash
cat /etc/resolv.conf | grep nameserver | awk '{print $2}'
```

Cập nhật file `.env` với IP vừa lấy được:
```env
DB_HOST=<WINDOWS_IP>  # Thay <WINDOWS_IP> bằng IP thực tế
DB_PORT=1434
DB_USER=your_username
DB_PASS=your_password
DB_NAME=your_database_name
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

## Nếu vẫn không kết nối được

### 1. Kiểm tra SQL Server TCP/IP
- Mở **SQL Server Configuration Manager**
- **SQL Server Network Configuration** > **Protocols for <YOUR_INSTANCE>** (thường là `SQLEXPRESS` hoặc `MSSQLSERVER`)
- Enable **TCP/IP** nếu chưa enable
- Restart SQL Server service

### 2. Cho phép Remote Connections
- Mở **SQL Server Management Studio**
- Connect đến `localhost\<YOUR_INSTANCE>` (thay `<YOUR_INSTANCE>` bằng tên instance của bạn)
- Right-click server > **Properties** > **Connections**
- Check **"Allow remote connections to this server"**
- Click **OK**

### 3. Bật SQL Server Authentication (nếu dùng username/password)
- Trong SSMS: Right-click server > **Properties** > **Security**
- Chọn **"SQL Server and Windows Authentication mode"**
- Click **OK** và restart SQL Server service

### 4. Kiểm tra SQL Server đang chạy
```powershell
# Trong PowerShell
netstat -an | findstr 1433 # 1434 (DB_PORT in docker)
# Phải thấy: TCP    0.0.0.0:1434           0.0.0.0:0              LISTENING
```

## Lưu ý

- **IP Windows host có thể thay đổi** sau mỗi lần restart Windows hoặc WSL
- Nếu IP thay đổi, cập nhật lại `DB_HOST` trong `.env` bằng cách chạy lại lệnh lấy IP
- Firewall rule phải dùng `-Profile Any` (không chỉ Private/Domain) để WSL kết nối được
- Nếu SQL Server instance không phải là `SQLEXPRESS`, thay đổi tên instance trong các bước cấu hình

## Files hỗ trợ

- `open-firewall-port.ps1` - Script mở firewall (chạy với quyền admin, không cần chỉnh sửa)
- `test-db-connection.sh` - Script test kết nối từ WSL (tự động lấy IP Windows host)

## Tóm tắt nhanh

1. **Mở firewall**: Chạy `open-firewall-port.ps1` trong PowerShell Admin
2. **Lấy IP**: `cat /etc/resolv.conf | grep nameserver | awk '{print $2}'` trong WSL
3. **Test**: `./test-db-connection.sh` trong WSL
4. **Cập nhật .env**: Đặt `DB_HOST` = IP vừa lấy được

