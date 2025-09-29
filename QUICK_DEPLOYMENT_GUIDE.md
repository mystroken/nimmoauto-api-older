# Quick Deployment Guide
## Express TypeScript Server - VPS Deployment

This is a quick reference guide for deploying your Express TypeScript server on a VPS.

---

## 🚀 Quick Start (Automated)

### 1. Upload Files to VPS
```bash
# On your local machine, upload the deployment script
scp deploy.sh user@your-vps-ip:/home/user/
scp -r . user@your-vps-ip:/var/www/endpoints/
```

### 2. Run Automated Setup
```bash
# SSH into your VPS
ssh user@your-vps-ip

# Run the deployment script
chmod +x deploy.sh
./deploy.sh
```

### 3. Deploy Your Application
```bash
# Navigate to app directory
cd /var/www/endpoints

# Install dependencies
npm install

# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com
```

---

## 📋 Manual Setup (Step by Step)

### Prerequisites
- Ubuntu 20.04+ VPS
- Domain name pointing to VPS
- SSH access

### 1. Initial Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update && sudo apt install -y mongodb-org

# Install other dependencies
sudo apt install -y git nginx certbot python3-certbot-nginx
sudo npm install -g pm2

# Configure firewall
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 2. Application Setup
```bash
# Create directories
sudo mkdir -p /var/www/endpoints
sudo chown $USER:$USER /var/www/endpoints
cd /var/www/endpoints

# Upload your application files here
# Then install dependencies
npm install
npm run build
```

### 3. Environment Configuration
```bash
# Create .env file
nano .env
```

Add your configuration:
```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/endpoints-prod
WHATSAPP_SESSION_PATH=/var/www/endpoints/whatsapp-session
# Add other environment variables as needed
```

### 4. Process Management
```bash
# Create PM2 config
nano ecosystem.config.js
```

Add:
```javascript
module.exports = {
  apps: [{
    name: 'endpoints-server',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: { NODE_ENV: 'production', PORT: 3000 }
  }]
};
```

### 5. Start Application
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 6. Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/endpoints
```

Add configuration (see full manual for details), then:
```bash
sudo ln -s /etc/nginx/sites-available/endpoints /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com
```

---

## 🔧 Common Commands

### Application Management
```bash
# Check status
pm2 status

# View logs
pm2 logs endpoints-server

# Restart
pm2 restart endpoints-server

# Monitor
pm2 monit
```

### System Management
```bash
# Check services
sudo systemctl status nginx
sudo systemctl status mongod

# View logs
sudo tail -f /var/log/nginx/error.log
sudo journalctl -u mongod -f

# Check resources
htop
df -h
free -h
```

### SSL Management
```bash
# Check certificates
sudo certbot certificates

# Renew manually
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

---

## 🚨 Troubleshooting

### Application Won't Start
```bash
# Check PM2 logs
pm2 logs endpoints-server

# Check if port is in use
sudo netstat -tlnp | grep :3000

# Restart PM2
pm2 restart all
```

### MongoDB Issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod

# Check connection
mongosh --eval "db.runCommand('ping')"
```

### Nginx Issues
```bash
# Check configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Check expiration
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -text -noout | grep "Not After"
```

---

## 📊 Monitoring

### Setup Monitoring Script
```bash
# Create monitoring script
nano /var/www/endpoints/monitor.sh
```

Add:
```bash
#!/bin/bash
if ! pm2 list | grep -q "endpoints-server"; then
    echo "$(date): Application down, restarting..." >> /var/log/endpoints/monitor.log
    cd /var/www/endpoints && pm2 start ecosystem.config.js --env production
fi
```

Make executable and add to cron:
```bash
chmod +x /var/www/endpoints/monitor.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /var/www/endpoints/monitor.sh") | crontab -
```

---

## 🔒 Security Checklist

- [ ] Firewall configured (UFW)
- [ ] Non-root user created
- [ ] SSH key authentication
- [ ] MongoDB secured
- [ ] Environment variables set
- [ ] SSL certificate installed
- [ ] Rate limiting configured
- [ ] Security headers added
- [ ] Regular backups scheduled

---

## 📞 Support

If you encounter issues:

1. Check application logs: `pm2 logs endpoints-server`
2. Check system logs: `sudo journalctl -xe`
3. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
4. Monitor resources: `htop`

For detailed instructions, refer to the full `DEPLOYMENT_MANUAL.md`.

---

## 🎯 Quick Verification

After deployment, test these endpoints:

```bash
# Health check
curl https://yourdomain.com/api/health

# WhatsApp QR page
curl https://yourdomain.com/

# API endpoints
curl https://yourdomain.com/api/users
```

---

**Note**: Replace `yourdomain.com` with your actual domain name throughout this guide.

