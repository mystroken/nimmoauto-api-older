# Deployment Checklist
## Express TypeScript Server - VPS Deployment

Use this checklist to ensure your deployment is complete and secure.

---

## ✅ Pre-Deployment Checklist

### VPS Requirements
- [ ] Ubuntu 20.04+ VPS provisioned
- [ ] Minimum 2GB RAM (4GB recommended)
- [ ] Minimum 20GB storage
- [ ] Domain name pointing to VPS IP
- [ ] SSH access configured

### Local Preparation
- [ ] Application code ready for deployment
- [ ] Environment variables documented
- [ ] API keys and tokens collected
- [ ] Database backup strategy planned

---

## ✅ Server Setup Checklist

### Initial Configuration
- [ ] System packages updated
- [ ] Non-root user created
- [ ] SSH key authentication enabled
- [ ] Firewall configured (UFW)
- [ ] SSH access secured

### Software Installation
- [ ] Node.js 18.x installed
- [ ] MongoDB 6.0 installed
- [ ] Nginx installed
- [ ] PM2 installed
- [ ] Certbot installed
- [ ] Git installed

### Service Configuration
- [ ] MongoDB service started and enabled
- [ ] Nginx service started and enabled
- [ ] Firewall rules applied
- [ ] Services configured for auto-start

---

## ✅ Application Deployment Checklist

### Directory Setup
- [ ] Application directory created (`/var/www/endpoints`)
- [ ] Log directory created (`/var/log/endpoints`)
- [ ] Backup directory created (`/var/backups/endpoints`)
- [ ] Proper ownership and permissions set

### Code Deployment
- [ ] Application files uploaded to server
- [ ] Dependencies installed (`npm install`)
- [ ] TypeScript compiled (`npm run build`)
- [ ] Environment file created and configured
- [ ] Required directories created (temp_images, temp_videos, whatsapp-session)

### Process Management
- [ ] PM2 ecosystem file created
- [ ] Application started with PM2
- [ ] PM2 configuration saved
- [ ] PM2 startup script configured
- [ ] Application running on port 3000

---

## ✅ Database Setup Checklist

### MongoDB Configuration
- [ ] MongoDB service running
- [ ] Database created (`endpoints-prod`)
- [ ] Database user created with proper permissions
- [ ] Authentication configured (if needed)
- [ ] Connection string updated in `.env`

### Security
- [ ] MongoDB authentication enabled
- [ ] Strong passwords set
- [ ] Network access restricted
- [ ] Database backups configured

---

## ✅ Web Server Configuration Checklist

### Nginx Setup
- [ ] Nginx configuration file created
- [ ] Site enabled in Nginx
- [ ] Default site removed
- [ ] Configuration syntax validated
- [ ] Nginx service restarted

### Proxy Configuration
- [ ] Reverse proxy configured for port 3000
- [ ] Rate limiting configured
- [ ] Security headers added
- [ ] File upload limits set
- [ ] Static file serving configured

### SSL Certificate
- [ ] Domain DNS configured correctly
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Certificate auto-renewal configured
- [ ] HTTPS redirect configured
- [ ] Certificate expiration monitored

---

## ✅ Security Checklist

### Access Control
- [ ] Non-root user for application
- [ ] SSH key authentication only
- [ ] Password authentication disabled
- [ ] SSH port changed (optional)
- [ ] Fail2ban configured (optional)

### Application Security
- [ ] Environment variables properly set
- [ ] Sensitive data not in code
- [ ] API keys and tokens secured
- [ ] Rate limiting enabled
- [ ] CORS configured properly

### System Security
- [ ] Firewall rules applied
- [ ] Unnecessary services disabled
- [ ] Regular security updates enabled
- [ ] Log monitoring configured
- [ ] Intrusion detection (optional)

---

## ✅ Monitoring & Maintenance Checklist

### Logging
- [ ] Application logs configured
- [ ] System logs monitored
- [ ] Nginx logs monitored
- [ ] MongoDB logs monitored
- [ ] Log rotation configured

### Monitoring
- [ ] Application health monitoring
- [ ] System resource monitoring
- [ ] Disk space monitoring
- [ ] Memory usage monitoring
- [ ] Network monitoring

### Backup Strategy
- [ ] Application files backup
- [ ] Database backup
- [ ] Configuration backup
- [ ] Backup automation configured
- [ ] Backup restoration tested

### Maintenance
- [ ] Update schedule planned
- [ ] Security patch process
- [ ] Performance monitoring
- [ ] Error alerting configured
- [ ] Maintenance window defined

---

## ✅ Testing Checklist

### Functionality Tests
- [ ] Application starts successfully
- [ ] Health check endpoint responds
- [ ] API endpoints accessible
- [ ] WhatsApp QR page loads
- [ ] Database connections work
- [ ] File uploads function
- [ ] Rate limiting works

### Security Tests
- [ ] HTTPS redirects work
- [ ] SSL certificate valid
- [ ] Security headers present
- [ ] Rate limiting enforced
- [ ] Unauthorized access blocked

### Performance Tests
- [ ] Application responds quickly
- [ ] Memory usage acceptable
- [ ] CPU usage reasonable
- [ ] Disk space adequate
- [ ] Network performance good

---

## ✅ Documentation Checklist

### Deployment Documentation
- [ ] Deployment manual created
- [ ] Quick reference guide available
- [ ] Troubleshooting guide written
- [ ] Command reference documented
- [ ] Configuration files documented

### Operational Documentation
- [ ] Monitoring procedures documented
- [ ] Backup procedures documented
- [ ] Update procedures documented
- [ ] Emergency procedures documented
- [ ] Contact information available

---

## ✅ Post-Deployment Verification

### Final Checks
- [ ] All services running
- [ ] Application accessible via domain
- [ ] SSL certificate working
- [ ] All API endpoints functional
- [ ] Monitoring alerts configured
- [ ] Backup system tested
- [ ] Performance baseline established

### Handover
- [ ] Access credentials documented
- [ ] Emergency procedures communicated
- [ ] Monitoring dashboard access provided
- [ ] Support contact information shared
- [ ] Maintenance schedule agreed

---

## 🚨 Emergency Contacts

- **Server Provider**: [Your VPS provider support]
- **Domain Registrar**: [Your domain registrar support]
- **SSL Provider**: Let's Encrypt Community Support
- **Application Support**: [Your development team]

---

## 📞 Quick Commands Reference

```bash
# Check application status
pm2 status

# View application logs
pm2 logs endpoints-server

# Restart application
pm2 restart endpoints-server

# Check system services
sudo systemctl status nginx mongod

# Check SSL certificate
sudo certbot certificates

# Monitor system resources
htop

# Check disk space
df -h

# View recent logs
sudo journalctl -xe
```

---

**Note**: This checklist should be completed for each deployment. Keep a copy of the completed checklist for future reference and troubleshooting.

