#!/bin/bash

# Monitoring script for multi-app deployment
# Checks health status of all services and system metrics

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo -e "${BLUE}📊 Multi-App Deployment Monitor${NC}"
echo "================================================"

# Source environment variables
if [ -f .env ]; then
    source .env
fi

# Check Docker daemon
echo -e "${YELLOW}🐳 Docker Status:${NC}"
if systemctl is-active --quiet docker; then
    echo -e "${GREEN}✅ Docker daemon is running${NC}"
else
    echo -e "${RED}❌ Docker daemon is not running${NC}"
fi

echo ""

# Check container status
echo -e "${YELLOW}📦 Container Status:${NC}"
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""

# Check resource usage
echo -e "${YELLOW}💾 Resource Usage:${NC}"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"

echo ""

# Check disk usage
echo -e "${YELLOW}💿 Disk Usage:${NC}"
df -h | grep -E "Filesystem|/dev/"

echo ""

# Check Docker volumes
echo -e "${YELLOW}📂 Docker Volumes:${NC}"
docker volume ls --format "table {{.Name}}\t{{.Driver}}"

echo ""

# Health check endpoints
if [ ! -z "$DOMAIN" ]; then
    echo -e "${YELLOW}🏥 Application Health Checks:${NC}"
    
    # OpenSign health check
    echo -n "OpenSign: "
    if curl -sf "https://$DOMAIN/opensign" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
    fi
    
    # n8n health check
    echo -n "n8n: "
    if curl -sf "https://$DOMAIN/n8n" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
    fi
    
    # Crawl4AI health check
    echo -n "Crawl4AI: "
    if curl -sf "https://$DOMAIN/crawl4ai/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
    fi
    
    # Traefik dashboard
    echo -n "Traefik: "
    if curl -sf "http://$DOMAIN:8080" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
    fi
    
    echo ""
fi

# Database connectivity
echo -e "${YELLOW}🗄️  Database Status:${NC}"
if docker exec postgres pg_isready -U "$DB_USER" -d multiapp > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
    
    # Show database sizes
    echo "Database sizes:"
    docker exec postgres psql -U "$DB_USER" -d multiapp -c "
    SELECT 
        datname as database_name,
        pg_size_pretty(pg_database_size(datname)) as size
    FROM pg_database 
    WHERE datname IN ('opensign', 'n8n', 'multiapp')
    ORDER BY pg_database_size(datname) DESC;" 2>/dev/null || echo "Could not fetch database sizes"
else
    echo -e "${RED}❌ PostgreSQL is not ready${NC}"
fi

echo ""

# Redis connectivity  
echo -e "${YELLOW}🔴 Redis Status:${NC}"
if docker exec redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is ready${NC}"
    
    # Show Redis info
    echo "Redis info:"
    docker exec redis redis-cli info memory | grep "used_memory_human\|used_memory_peak_human" 2>/dev/null || echo "Could not fetch Redis memory info"
else
    echo -e "${RED}❌ Redis is not ready${NC}"
fi

echo ""

# SSL Certificate status
if [ ! -z "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    echo -e "${YELLOW}🔒 SSL Certificate Status:${NC}"
    if command -v openssl > /dev/null; then
        echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "Could not check SSL certificate"
    else
        echo "OpenSSL not available for certificate check"
    fi
    echo ""
fi

# Recent logs (last 10 lines from each service)
echo -e "${YELLOW}📋 Recent Logs (last 5 lines per service):${NC}"
for service in traefik postgres redis opensign n8n crawl4ai; do
    echo -e "${BLUE}--- $service ---${NC}"
    docker-compose logs --tail=5 "$service" 2>/dev/null || echo "Service $service not found"
    echo ""
done

# System uptime
echo -e "${YELLOW}⏰ System Information:${NC}"
echo "Uptime: $(uptime)"
echo "Load average: $(cat /proc/loadavg)"
echo "Memory: $(free -h | grep Mem)"

echo ""
echo -e "${GREEN}📊 Monitoring completed at $(date)${NC}"
echo -e "${YELLOW}💡 Run this script periodically or set up a cron job for continuous monitoring${NC}" 