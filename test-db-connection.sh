#!/bin/bash
# Script to test SQL Server connection from WSL

echo "=== Testing SQL Server Connection from WSL ==="
echo ""

# Get Windows host IP
WINDOWS_IP=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}')
echo "Windows host IP: $WINDOWS_IP"
echo ""

# Test ping
echo "1. Testing ping to Windows host..."
if ping -c 2 -W 2 $WINDOWS_IP > /dev/null 2>&1; then
    echo "   [OK] Ping successful"
else
    echo "   [WARN] Ping failed (this is normal if Windows firewall blocks ICMP)"
fi
echo ""

# Test port 1433
echo "2. Testing port 1433..."
if timeout 5 bash -c "echo > /dev/tcp/$WINDOWS_IP/1433" 2>/dev/null; then
    echo "   [OK] Port 1433 is open and accessible"
    PORT_OPEN=true
else
    echo "   [ERROR] Port 1433 is closed or unreachable"
    echo "   -> Check Windows firewall and SQL Server TCP/IP configuration"
    PORT_OPEN=false
fi
echo ""

# Test SQL Server connection (if sqlcmd is available)
if command -v sqlcmd &> /dev/null; then
    echo "3. Testing SQL Server connection with sqlcmd..."
    if [ "$PORT_OPEN" = true ]; then
        echo "   Enter SQL Server username (or press Enter to skip): "
        read -r DB_USER
        if [ -n "$DB_USER" ]; then
            echo "   Enter SQL Server password: "
            read -s DB_PASS
            echo ""
            if sqlcmd -S "$WINDOWS_IP,1433" -U "$DB_USER" -P "$DB_PASS" -Q "SELECT @@VERSION" 2>/dev/null; then
                echo "   [OK] SQL Server connection successful!"
            else
                echo "   [ERROR] SQL Server connection failed"
                echo "   -> Check username, password, and SQL Server authentication settings"
            fi
        else
            echo "   [SKIP] Skipped (no username provided)"
        fi
    else
        echo "   [SKIP] Port is not open, cannot test connection"
    fi
else
    echo "3. sqlcmd not found. Install with: sudo apt-get install mssql-tools"
fi
echo ""

# Summary
echo "=== Summary ==="
echo "Windows IP: $WINDOWS_IP"
echo "Port 1433: $([ "$PORT_OPEN" = true ] && echo 'OPEN' || echo 'CLOSED')"
echo ""
echo "If port is closed, follow the steps in WSL-SQL-SERVER-SETUP.md"
echo "Update your .env file with: DB_HOST=$WINDOWS_IP"

