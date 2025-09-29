#!/bin/bash

# VPS Deployment Script for Express TypeScript Server
# This script automates the initial setup process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Configuration variables
APP_NAME="endpoints"
APP_DIR="/var/www/$APP_NAME"
LOG_DIR="/var/log/$APP_NAME"
BACKUP_DIR="/var/backups/$APP_NAME"
DOMAIN_NAME=""
DB_NAME="${APP_NAME}-prod"
DB_USER="${APP_NAME}_user"
DB_PASSWORD=""

# Function to get user input
get_user_input() {
    read -p "Enter your domain name (e.g., example.com): " DOMAIN_NAME
    read -s -p "Enter MongoDB password for $DB_USER: " DB_PASSWORD
    echo
    read -s -p "Confirm MongoDB password: " DB_PASSWORD_CONFIRM
    echo
    
    if [ "$DB_PASSWORD" != "$DB_PASSWORD_CONFIRM" ]; then
        print_error "Passwords do not match!"
        exit 1
    fi
}

# Function to update system
update_system() {
    print_status "Updating system packages..."
    sudo apt update && sudo apt upgrade -y
    print_success "System updated successfully"
}

# Function to install Node.js
install_nodejs() {
    print_status "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_success "Node.js installed successfully"
}

# Function to install MongoDB
install_mongodb() {
    print_status "Installing MongoDB..."
    wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
    sudo apt update
    sudo apt install -y mongodb-org
    print_success "MongoDB installed successfully"
}

# Function to install other dependencies
install_dependencies() {
    print_status "Installing other dependencies..."
    sudo apt install -y git nginx certbot python3-certbot-nginx
    sudo npm install -g pm2
    print_success "Dependencies installed successfully"
}

# Function to configure firewall
configure_firewall() {
    print_status "Configuring firewall..."
    sudo ufw allow ssh
    sudo ufw allow 'Nginx Full'
    sudo ufw --force enable
    print_success "Firewall configured successfully"
}

# Function to setup application directory
setup_app_directory() {
    print_status "Setting up application directory..."
    sudo mkdir -p $APP_DIR
    sudo chown $USER:$USER $APP_DIR
    sudo mkdir -p $LOG_DIR
    sudo chown $USER:$USER $LOG_DIR
    sudo mkdir -p $BACKUP_DIR
    sudo chown $USER:$USER $BACKUP_DIR
    print_success "Application directory setup complete"
}

# Function to setup MongoDB
setup_mongodb() {
    print_status "Setting up MongoDB..."
    sudo systemctl start mongod
    sudo systemctl enable mongod
    
    # Create database and user
    mongosh --eval "
        use $DB_NAME
        db.createUser({
            user: '$DB_USER',
            pwd: '$DB_PASSWORD',
            roles: ['readWrite']
        })
    "
    print_success "MongoDB setup complete"
}

# Function to create environment file
create_env_file() {
    print_status "Creating environment file..."
    cat > $APP_DIR/.env << EOF
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
MONGODB_URI=mongodb://$DB_USER:$DB_PASSWORD@localhost:27017/$DB_NAME

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=$APP_DIR/whatsapp-session

# Social Media APIs (update these with your actual values)
FACEBOOK_ACCESS_TOKEN=your_facebook_token
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret

# Webhook URLs
WEBHOOK_URL=https://$DOMAIN_NAME/api/webhook

# Security
SESSION_SECRET=$(openssl rand -hex 32)
EOF
    print_success "Environment file created"
}

# Function to create PM2 ecosystem file
create_pm2_config() {
    print_status "Creating PM2 configuration..."
    cat > $APP_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME-server',
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
    error_file: '$LOG_DIR/err.log',
    out_file: '$LOG_DIR/out.log',
    log_file: '$LOG_DIR/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
    print_success "PM2 configuration created"
}

# Function to create Nginx configuration
create_nginx_config() {
    print_status "Creating Nginx configuration..."
    sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=whatsapp:10m rate=5r/s;

    # Main application
    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # API endpoints
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WhatsApp endpoints
    location /api/whatsapp/ {
        limit_req zone=whatsapp burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300;
    }

    # Static files
    location /public/ {
        alias $APP_DIR/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # File uploads
    client_max_body_size 10M;
}
EOF

    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl restart nginx
    print_success "Nginx configuration created and enabled"
}

# Function to create monitoring script
create_monitoring_script() {
    print_status "Creating monitoring script..."
    cat > $APP_DIR/monitor.sh << 'EOF'
#!/bin/bash

# Check if application is running
if ! pm2 list | grep -q "endpoints-server"; then
    echo "$(date): Application is down, restarting..." >> /var/log/endpoints/monitor.log
    cd /var/www/endpoints && pm2 start ecosystem.config.js --env production
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
EOF
    chmod +x $APP_DIR/monitor.sh
    print_success "Monitoring script created"
}

# Function to create backup script
create_backup_script() {
    print_status "Creating backup script..."
    cat > $APP_DIR/backup.sh << EOF
#!/bin/bash

BACKUP_DIR="$BACKUP_DIR"
DATE=\$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p \$BACKUP_DIR

# Backup application files
tar -czf \$BACKUP_DIR/app_\$DATE.tar.gz -C /var/www endpoints

# Backup MongoDB
mongodump --db $DB_NAME --out \$BACKUP_DIR/mongodb_\$DATE

# Keep only last 7 days of backups
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find \$BACKUP_DIR -name "mongodb_*" -mtime +7 -exec rm -rf {} \;
EOF
    chmod +x $APP_DIR/backup.sh
    print_success "Backup script created"
}

# Function to setup log rotation
setup_log_rotation() {
    print_status "Setting up log rotation..."
    sudo tee /etc/logrotate.d/$APP_NAME > /dev/null << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
    print_success "Log rotation configured"
}

# Function to setup cron jobs
setup_cron_jobs() {
    print_status "Setting up cron jobs..."
    (crontab -l 2>/dev/null; echo "*/5 * * * * $APP_DIR/monitor.sh") | crontab -
    (crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/backup.sh") | crontab -
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    print_success "Cron jobs configured"
}

# Function to display next steps
display_next_steps() {
    echo
    print_success "Deployment setup completed successfully!"
    echo
    echo "Next steps:"
    echo "1. Upload your application code to: $APP_DIR"
    echo "2. Install dependencies: cd $APP_DIR && npm install"
    echo "3. Build the application: npm run build"
    echo "4. Start the application: pm2 start ecosystem.config.js --env production"
    echo "5. Save PM2 configuration: pm2 save && pm2 startup"
    echo "6. Get SSL certificate: sudo certbot --nginx -d $DOMAIN_NAME"
    echo "7. Test your application: https://$DOMAIN_NAME"
    echo
    echo "Useful commands:"
    echo "- Check application status: pm2 status"
    echo "- View logs: pm2 logs $APP_NAME-server"
    echo "- Restart application: pm2 restart $APP_NAME-server"
    echo "- Monitor resources: pm2 monit"
    echo
    print_warning "Don't forget to update the social media API tokens in $APP_DIR/.env"
}

# Main execution
main() {
    echo "=========================================="
    echo "VPS Deployment Script for Express Server"
    echo "=========================================="
    echo
    
    # Get user input
    get_user_input
    
    # Execute setup steps
    update_system
    install_nodejs
    install_mongodb
    install_dependencies
    configure_firewall
    setup_app_directory
    setup_mongodb
    create_env_file
    create_pm2_config
    create_nginx_config
    create_monitoring_script
    create_backup_script
    setup_log_rotation
    setup_cron_jobs
    
    # Display next steps
    display_next_steps
}

# Run main function
main "$@"

