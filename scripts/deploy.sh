#!/bin/bash

# Multi-App Deployment Script
# Deploys OpenSign, n8n, and Crawl4AI with Traefik reverse proxy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Multi-App Deployment Script${NC}"
echo "================================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please copy .env.example to .env and configure your settings:"
    echo "cp .env.example .env"
    echo "nano .env"
    exit 1
fi

# Source environment variables
source .env

# Validate required environment variables
echo -e "${YELLOW}🔍 Validating environment variables...${NC}"
required_vars=("DOMAIN" "SSL_EMAIL" "DB_USER" "DB_PASSWORD")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌ $var is not set in .env file${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ Environment variables validated${NC}"

# Check if Docker is installed
echo -e "${YELLOW}🐳 Checking Docker installation...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker not found. Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}✅ Docker installed successfully${NC}"
    echo -e "${YELLOW}⚠️  Please logout and login again, then re-run this script${NC}"
    exit 0
else
    echo -e "${GREEN}✅ Docker is installed${NC}"
fi

# Check if Docker Compose is installed
echo -e "${YELLOW}🔧 Checking Docker Compose installation...${NC}"
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}Docker Compose not found. Installing...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker Compose is installed${NC}"
fi

# Create required directories
echo -e "${YELLOW}📁 Creating required directories...${NC}"
mkdir -p opensign n8n-data crawl4ai-data init-scripts logs backups

# Check if domain is accessible (if not localhost)
if [ "$DOMAIN" != "localhost" ] && [ "$DOMAIN" != "127.0.0.1" ]; then
    echo -e "${YELLOW}🌐 Checking domain accessibility...${NC}"
    if ! ping -c 1 "$DOMAIN" &> /dev/null; then
        echo -e "${YELLOW}⚠️  Warning: Domain $DOMAIN is not reachable${NC}"
        echo "Make sure your DNS records are properly configured:"
        echo "Type: A, Name: @, Value: YOUR_SERVER_IP"
        echo "Type: A, Name: *, Value: YOUR_SERVER_IP"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Domain is accessible${NC}"
    fi
fi

# Pull Docker images
echo -e "${YELLOW}📦 Pulling Docker images...${NC}"
docker-compose pull

# Build custom images
echo -e "${YELLOW}🔨 Building custom images...${NC}"
docker-compose build

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 30

# Check service status
echo -e "${YELLOW}🔍 Checking service status...${NC}"
docker-compose ps

# Display access URLs
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo "================================================"
echo -e "${GREEN}📱 Application URLs:${NC}"
echo "🔐 OpenSign:       https://$DOMAIN/opensign"
echo "🔄 n8n:            https://$DOMAIN/n8n"
echo "🕷️  Crawl4AI:       https://$DOMAIN/crawl4ai"
echo "📊 Traefik Dashboard: http://$DOMAIN:8080"
echo ""
echo -e "${GREEN}🛠️  Useful Commands:${NC}"
echo "View logs:         docker-compose logs -f"
echo "Restart service:   docker-compose restart [service-name]"
echo "Stop all:          docker-compose down"
echo "Update:            ./scripts/update.sh"
echo "Backup:            ./scripts/backup.sh"
echo ""
echo -e "${YELLOW}⚠️  Note: SSL certificates may take a few minutes to provision${NC}"
echo "If HTTPS doesn't work immediately, wait 2-3 minutes and try again." 