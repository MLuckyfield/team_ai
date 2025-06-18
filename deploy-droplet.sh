#!/bin/bash

# n8n + PostgreSQL Droplet Deployment Script
# This script sets up n8n with PostgreSQL on a DigitalOcean Droplet

set -e

echo "🚀 Starting n8n + PostgreSQL deployment on DigitalOcean Droplet..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script as root (use sudo)"
    exit 1
fi

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
    rm get-docker.sh
else
    print_status "Docker is already installed"
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    print_status "Docker Compose is already installed"
fi

# Create application directory
APP_DIR="/opt/n8n"
print_status "Creating application directory at $APP_DIR..."
mkdir -p $APP_DIR
cd $APP_DIR

# Copy configuration files (assuming they're in current directory)
if [ -f "$HOME/docker-compose.droplet.yml" ]; then
    cp $HOME/docker-compose.droplet.yml $APP_DIR/docker-compose.yml
    cp $HOME/init-db.sql $APP_DIR/
    cp $HOME/nginx.conf $APP_DIR/
    cp $HOME/env.droplet.template $APP_DIR/.env
else
    print_error "Configuration files not found in home directory"
    print_error "Please upload the following files to your home directory:"
    print_error "- docker-compose.droplet.yml"
    print_error "- init-db.sql"
    print_error "- nginx.conf"
    print_error "- env.droplet.template"
    exit 1
fi

# Create SSL directory
mkdir -p ssl

# Check if .env file exists and is configured
if [ -f ".env" ]; then
    if grep -q "your_secure_postgres_password_here" .env; then
        print_warning "Please edit the .env file with your actual configuration:"
        print_warning "  nano .env"
        print_warning ""
        print_warning "Required changes:"
        print_warning "- Set POSTGRES_PASSWORD to a secure password"
        print_warning "- Set N8N_ENCRYPTION_KEY to a secure 32+ character key"
        print_warning "- Set your domain name and SSL email"
        print_warning "- Add your AI API keys if needed"
        print_warning ""
        print_warning "After editing .env, run this script again or run:"
        print_warning "  docker-compose up -d"
        exit 1
    fi
else
    print_error ".env file not found!"
    exit 1
fi

# Create Docker volumes
print_status "Creating Docker volumes..."
docker volume create n8n_postgres_data
docker volume create n8n_data
docker volume create n8n_files

# Install firewall if not present
if ! command -v ufw &> /dev/null; then
    print_status "Installing UFW firewall..."
    apt install -y ufw
fi

# Configure firewall
print_status "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5678/tcp  # n8n port for development
echo "y" | ufw enable

# Start the services
print_status "Starting n8n and PostgreSQL services..."
docker-compose up -d

# Wait for services to be ready
print_status "Waiting for services to start..."
sleep 30

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    print_status "✅ Services are running!"
    echo ""
    print_status "🎉 Deployment completed successfully!"
    echo ""
    print_status "Access your n8n instance at:"
    print_status "  http://$(curl -s ifconfig.me):5678"
    echo ""
    print_status "For production with SSL:"
    print_status "1. Point your domain to this server's IP: $(curl -s ifconfig.me)"
    print_status "2. Obtain SSL certificates (Let's Encrypt recommended)"
    print_status "3. Place certificates in ./ssl/ directory"
    print_status "4. Run: docker-compose --profile production up -d"
    echo ""
    print_status "Useful commands:"
    print_status "  View logs: docker-compose logs -f"
    print_status "  Stop services: docker-compose down"
    print_status "  Restart: docker-compose restart"
    print_status "  Update: docker-compose pull && docker-compose up -d"
else
    print_error "Services failed to start. Check logs with: docker-compose logs"
    exit 1
fi 