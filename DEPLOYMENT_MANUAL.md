# VPS Deployment Manual
## Express TypeScript Server with WhatsApp Integration

This manual provides step-by-step instructions for deploying the Express TypeScript server on a VPS (Virtual Private Server).

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [VPS Setup](#vps-setup)
3. [Server Preparation](#server-preparation)
4. [Application Deployment](#application-deployment)
5. [Database Setup](#database-setup)
6. [Environment Configuration](#environment-configuration)
7. [Process Management](#process-management)
8. [Reverse Proxy Setup](#reverse-proxy-setup)
9. [SSL Certificate](#ssl-certificate)
10. [Monitoring & Maintenance](#monitoring--maintenance)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **VPS Provider**: DigitalOcean, AWS, Vultr, Linode, or similar
- **Operating System**: Ubuntu 20.04 LTS or later (recommended)
- **Domain Name**: For SSL and production use
- **SSH Access**: To connect to your VPS

### Minimum VPS Specifications
- **RAM**: 2GB minimum (4GB recommended)
- **Storage**: 20GB minimum
- **CPU**: 1 vCPU minimum
- **Bandwidth**: 1TB/month minimum

---

## VPS Setup

### 1. Connect to Your VPS
```bash
ssh root@your-vps-ip-address
```

### 2. Create a Non-Root User (Security Best Practice)
```bash
# Create new user
adduser deploy

# Add user to sudo group
usermod -aG sudo deploy

# Switch to new user
su - deploy
```

### 3. Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### 4. Install Essential Software
```bash
# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git
sudo apt install git -y

# Install Nginx
sudo apt install nginx -y

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
```

### 5. Configure Firewall
```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Server Preparation

### 1. Create Application Directory
```bash
# Create directory for the application
sudo mkdir -p /var/www/endpoints
sudo chown deploy:deploy /var/www/endpoints
cd /var/www/endpoints
```

### 2. Clone Your Repository
```bash
# Clone your repository (replace with your actual repo URL)
git clone https://github.com/yourusername/endpoints.git .

# Or if you have a private repository, use SSH key authentication
```

### 3. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Build the TypeScript application
npm run build
```

---

## Application Deployment

### 1. Create Environment File
```bash
# Create .env file
nano .env
```

Add the following configuration (adjust values as needed):
```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/endpoints-prod

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=/var/www/endpoints/whatsapp-session

# Social Media APIs (if using)
FACEBOOK_ACCESS_TOKEN=your_facebook_token
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret

# Webhook URLs (if using)
WEBHOOK_URL=https://yourdomain.com/api/webhook

# Security
SESSION_SECRET=your-super-secret-session-key
```

### 2. Create PM2 Ecosystem File
```bash
# Create PM2 configuration
nano ecosystem.config.js
```

Add the following configuration:
```javascript
module.exports = {
  apps: [{
    name: 'endpoints-server',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/endpoints/err.log',
    out_file: '/var/log/endpoints/out.log',
    log_file: '/var/log/endpoints/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 3. Create Log Directory
```bash
sudo mkdir -p /var/log/endpoints
sudo chown deploy:deploy /var/log/endpoints
```

### 4. Start Application with PM2
```bash
# Start the application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

---

## Database Setup

### 1. Start MongoDB Service
```bash
# Start MongoDB
sudo systemctl start mongod

# Enable MongoDB to start on boot
sudo systemctl enable mongod

# Check MongoDB status
sudo systemctl status mongod
```

### 2. Secure MongoDB (Optional but Recommended)
```bash
# Access MongoDB shell
mongosh

# Create admin user
use admin
db.createUser({
  user: "admin",
  pwd: "your-secure-password",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

# Create application database and user
use endpoints-prod
db.createUser({
  user: "endpoints_user",
  pwd: "your-app-password",
  roles: ["readWrite"]
})

# Exit MongoDB shell
exit
```

### 3. Update MongoDB Configuration (if using authentication)
```bash
# Edit MongoDB configuration
sudo nano /etc/mongod.conf
```

Add authentication:
```yaml
security:
  authorization: enabled
```

Restart MongoDB:
```bash
sudo systemctl restart mongod
```

Update your `.env` file with authentication:
```env
MONGODB_URI=mongodb://endpoints_user:your-app-password@localhost:27017/endpoints-prod
```

---

## Environment Configuration

### 1. Set Proper File Permissions
```bash
# Set ownership
sudo chown -R deploy:deploy /var/www/endpoints

# Set proper permissions
chmod 755 /var/www/endpoints
chmod 644 /var/www/endpoints/.env
```

### 2. Create Required Directories
```bash
# Create directories for file uploads
mkdir -p /var/www/endpoints/temp_images
mkdir -p /var/www/endpoints/temp_videos
mkdir -p /var/www/endpoints/whatsapp-session

# Set permissions
chmod 755 /var/www/endpoints/temp_images
chmod 755 /var/www/endpoints/temp_videos
chmod 755 /var/www/endpoints/whatsapp-session
```

---

## Process Management

### PM2 Commands
```bash
# Check application status
pm2 status

# View logs
pm2 logs endpoints-server

# Restart application
pm2 restart endpoints-server

# Stop application
pm2 stop endpoints-server

# Delete application from PM2
pm2 delete endpoints-server

# Monitor resources
pm2 monit
```

### Application Health Check
```bash
# Test if the application is running
curl http://localhost:3000/api/health

# Check if WhatsApp QR code page is accessible
curl http://localhost:3000/
```

---

## Reverse Proxy Setup

### 1. Configure Nginx
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/endpoints
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=whatsapp:10m rate=5r/s;

    # Main application
    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # API endpoints with stricter rate limiting
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WhatsApp endpoints with special rate limiting
    location /api/whatsapp/ {
        limit_req zone=whatsapp burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
    }

    # Static files
    location /public/ {
        alias /var/www/endpoints/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # File uploads (if needed)
    client_max_body_size 10M;
}
```

### 2. Enable the Site
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/endpoints /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## SSL Certificate

### 1. Obtain SSL Certificate with Let's Encrypt
```bash
# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

### 2. Setup Automatic Renewal
```bash
# Add to crontab
sudo crontab -e
```

Add this line:
```
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## Monitoring & Maintenance

### 1. Setup Log Rotation
```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/endpoints
```

Add:
```
/var/log/endpoints/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 deploy deploy
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 2. Setup Monitoring Script
```bash
# Create monitoring script
nano /var/www/endpoints/monitor.sh
```

Add:
```bash
#!/bin/bash

# Check if application is running
if ! pm2 list | grep -q "endpoints-server"; then
    echo "$(date): Application is down, restarting..." >> /var/log/endpoints/monitor.log
    pm2 start ecosystem.config.js --env production
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): Disk usage is high: ${DISK_USAGE}%" >> /var/log/endpoints/monitor.log
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.2f", $3*100/$2}')
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    echo "$(date): Memory usage is high: ${MEMORY_USAGE}%" >> /var/log/endpoints/monitor.log
fi
```

Make it executable:
```bash
chmod +x /var/www/endpoints/monitor.sh
```

Add to crontab:
```bash
# Run every 5 minutes
*/5 * * * * /var/www/endpoints/monitor.sh
```

### 3. Backup Strategy
```bash
# Create backup script
nano /var/www/endpoints/backup.sh
```

Add:
```bash
#!/bin/bash

BACKUP_DIR="/var/backups/endpoints"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C /var/www endpoints

# Backup MongoDB
mongodump --db endpoints-prod --out $BACKUP_DIR/mongodb_$DATE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "mongodb_*" -mtime +7 -exec rm -rf {} \;
```

Make it executable:
```bash
chmod +x /var/www/endpoints/backup.sh
```

Add to crontab for daily backups:
```bash
# Daily backup at 2 AM
0 2 * * * /var/www/endpoints/backup.sh
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Application Won't Start
```bash
# Check PM2 logs
pm2 logs endpoints-server

# Check if port is in use
sudo netstat -tlnp | grep :3000

# Check application status
pm2 status
```

#### 2. MongoDB Connection Issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo journalctl -u mongod

# Test MongoDB connection
mongosh --eval "db.runCommand('ping')"
```

#### 3. Nginx Issues
```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx configuration
sudo nginx -t

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

#### 4. SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check certificate expiration
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -text -noout | grep "Not After"
```

#### 5. Memory Issues
```bash
# Check memory usage
free -h

# Check PM2 memory usage
pm2 monit

# Restart application if needed
pm2 restart endpoints-server
```

#### 6. Disk Space Issues
```bash
# Check disk usage
df -h

# Clean up old logs
sudo find /var/log -name "*.log" -mtime +30 -delete

# Clean up PM2 logs
pm2 flush
```

### Performance Optimization

#### 1. Enable Gzip Compression
Add to Nginx configuration:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 6;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/json
    application/javascript
    application/xml+rss
    application/atom+xml
    image/svg+xml;
```

#### 2. Enable Browser Caching
Add to Nginx configuration:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## Security Checklist

- [ ] Firewall configured (UFW)
- [ ] Non-root user created
- [ ] SSH key authentication enabled
- [ ] MongoDB secured with authentication
- [ ] Environment variables properly set
- [ ] SSL certificate installed
- [ ] Rate limiting configured
- [ ] Security headers added
- [ ] Regular backups scheduled
- [ ] Monitoring scripts in place
- [ ] Log rotation configured
- [ ] Automatic updates enabled

---

## Maintenance Schedule

### Daily
- Check application logs: `pm2 logs endpoints-server`
- Monitor system resources: `htop`
- Check disk space: `df -h`

### Weekly
- Update system packages: `sudo apt update && sudo apt upgrade`
- Review and rotate logs
- Check SSL certificate status

### Monthly
- Review security updates
- Test backup restoration
- Monitor performance metrics
- Update application dependencies

---

## Support

For additional support:
1. Check the application logs: `pm2 logs endpoints-server`
2. Review system logs: `sudo journalctl -xe`
3. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
4. Monitor system resources: `htop` or `top`

---

## Quick Commands Reference

```bash
# Application Management
pm2 start ecosystem.config.js --env production
pm2 stop endpoints-server
pm2 restart endpoints-server
pm2 logs endpoints-server
pm2 status

# System Management
sudo systemctl status nginx
sudo systemctl restart nginx
sudo systemctl status mongod
sudo systemctl restart mongod

# Monitoring
htop
df -h
free -h
sudo netstat -tlnp

# Logs
pm2 logs endpoints-server
sudo tail -f /var/log/nginx/error.log
sudo journalctl -u mongod -f

# SSL
sudo certbot renew
sudo certbot certificates
```

---

**Note**: This manual assumes Ubuntu 20.04 LTS. Adjust commands for other distributions as needed. Always test in a staging environment before deploying to production.

