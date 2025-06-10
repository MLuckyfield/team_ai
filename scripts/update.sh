#!/bin/bash

# Update script for multi-app deployment
# Safely updates all services while preserving data

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🔄 Starting update process...${NC}"

# Create backup before update
echo -e "${YELLOW}📦 Creating backup before update...${NC}"
./scripts/backup.sh

# Pull latest images
echo -e "${YELLOW}📥 Pulling latest Docker images...${NC}"
docker-compose pull

# Rebuild custom images
echo -e "${YELLOW}🔨 Rebuilding custom images...${NC}"
docker-compose build --no-cache opensign

# Stop services gracefully
echo -e "${YELLOW}🛑 Stopping services gracefully...${NC}"
docker-compose down

# Start services with updated images
echo -e "${YELLOW}🚀 Starting services with updated images...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 30

# Check service health
echo -e "${YELLOW}🔍 Checking service health...${NC}"
docker-compose ps

# Test application endpoints
if [ -f .env ]; then
    source .env
    if [ ! -z "$DOMAIN" ]; then
        echo -e "${YELLOW}🌐 Testing application endpoints...${NC}"
        
        # Test OpenSign
        if curl -sf "https://$DOMAIN/opensign" > /dev/null; then
            echo -e "${GREEN}✅ OpenSign is accessible${NC}"
        else
            echo -e "${RED}❌ OpenSign is not accessible${NC}"
        fi
        
        # Test n8n
        if curl -sf "https://$DOMAIN/n8n" > /dev/null; then
            echo -e "${GREEN}✅ n8n is accessible${NC}"
        else
            echo -e "${RED}❌ n8n is not accessible${NC}"
        fi
        
        # Test Crawl4AI
        if curl -sf "https://$DOMAIN/crawl4ai/health" > /dev/null; then
            echo -e "${GREEN}✅ Crawl4AI is accessible${NC}"
        else
            echo -e "${RED}❌ Crawl4AI is not accessible${NC}"
        fi
    fi
fi

# Clean up unused images
echo -e "${YELLOW}🧹 Cleaning up unused Docker images...${NC}"
docker image prune -f

# Show final status
echo -e "${GREEN}✅ Update completed successfully!${NC}"
echo ""
echo "Updated services:"
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo -e "${GREEN}📱 Your applications should now be running with the latest updates:${NC}"
if [ ! -z "$DOMAIN" ]; then
    echo "🔐 OpenSign:       https://$DOMAIN/opensign"
    echo "🔄 n8n:            https://$DOMAIN/n8n"
    echo "🕷️  Crawl4AI:       https://$DOMAIN/crawl4ai"
    echo "📊 Traefik Dashboard: http://$DOMAIN:8080"
fi

echo ""
echo -e "${YELLOW}💡 If you encounter any issues, you can restore from the backup created before this update.${NC}" 