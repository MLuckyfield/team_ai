# Multi-Application Deployment Architecture

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Digital Ocean Droplet                    │
│                    (8GB RAM, 4 vCPUs)                      │
├─────────────────────────────────────────────────────────────┤
│                      Traefik Proxy                         │
│                    (Port 80/443)                           │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │ /opensign/*  │ /n8n/*       │ /crawl4ai/*              │ │
│  │              │              │                          │ │
│  └──────────────┴──────────────┴──────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  OpenSign   │ │     n8n     │ │       Crawl4AI          │ │
│  │  :3000      │ │   :5678     │ │       :11235            │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Shared PostgreSQL                          │ │
│  │                   :5432                                 │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                Shared Redis                             │ │
│  │                   :6379                                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📝 Docker Compose Configuration

### Main docker-compose.yml

```yaml
version: '3.8'

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  opensign_data:
  n8n_data:
  crawl4ai_data:
  traefik_data:

services:
  # Reverse Proxy
  traefik:
    image: traefik:v2.10
    container_name: traefik
    restart: unless-stopped
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=${SSL_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_data:/letsencrypt
    networks:
      - app-network

  # Shared Database
  postgres:
    image: postgres:15
    container_name: postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: multiapp
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    networks:
      - app-network

  # Shared Redis
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - app-network

  # OpenSign Application
  opensign:
    build:
      context: ./opensign
      dockerfile: Dockerfile
    container_name: opensign
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/opensign
      - REDIS_URL=redis://redis:6379
      - PUBLIC_URL=${DOMAIN}/opensign
    volumes:
      - opensign_data:/app/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opensign.rule=Host(`${DOMAIN}`) && PathPrefix(`/opensign`)"
      - "traefik.http.routers.opensign.entrypoints=websecure"
      - "traefik.http.routers.opensign.tls.certresolver=letsencrypt"
      - "traefik.http.middlewares.opensign-stripprefix.stripprefix.prefixes=/opensign"
      - "traefik.http.routers.opensign.middlewares=opensign-stripprefix"
      - "traefik.http.services.opensign.loadbalancer.server.port=3000"
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

  # n8n Workflow Automation
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_USER=${DB_USER}
      - DB_POSTGRESDB_PASSWORD=${DB_PASSWORD}
      - N8N_HOST=${DOMAIN}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://${DOMAIN}/n8n/
      - N8N_PATH=/n8n
      - VUE_APP_URL_BASE_API=https://${DOMAIN}/n8n/
    volumes:
      - n8n_data:/home/node/.n8n
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.n8n.rule=Host(`${DOMAIN}`) && PathPrefix(`/n8n`)"
      - "traefik.http.routers.n8n.entrypoints=websecure"
      - "traefik.http.routers.n8n.tls.certresolver=letsencrypt"
      - "traefik.http.services.n8n.loadbalancer.server.port=5678"
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

  # Crawl4AI Service
  crawl4ai:
    image: unclecode/crawl4ai:latest
    container_name: crawl4ai
    restart: unless-stopped
    environment:
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - crawl4ai_data:/app/data
      - ./crawl4ai-config.yml:/app/config.yml
    shm_size: 1g
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.crawl4ai.rule=Host(`${DOMAIN}`) && PathPrefix(`/crawl4ai`)"
      - "traefik.http.routers.crawl4ai.entrypoints=websecure"
      - "traefik.http.routers.crawl4ai.tls.certresolver=letsencrypt"
      - "traefik.http.middlewares.crawl4ai-stripprefix.stripprefix.prefixes=/crawl4ai"
      - "traefik.http.routers.crawl4ai.middlewares=crawl4ai-stripprefix"
      - "traefik.http.services.crawl4ai.loadbalancer.server.port=11235"
    depends_on:
      - redis
    networks:
      - app-network
```

### Environment Configuration (.env)

```bash
# Domain Configuration
DOMAIN=your-domain.com
SSL_EMAIL=your-email@domain.com

# Database Configuration
DB_USER=multiapp_user
DB_PASSWORD=your_secure_password

# API Keys for Crawl4AI
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Application Specific
NODE_ENV=production
```

## 🐳 Application-Specific Dockerfiles

### OpenSign Dockerfile (./opensign/Dockerfile)

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Clone OpenSign repository
RUN apk add --no-cache git
RUN git clone https://github.com/OpenSignLabs/OpenSign.git .

# Install dependencies
RUN npm install

# Build the application
RUN npm run build

# Configure for path-based routing
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 3000

CMD ["npm", "start"]
```

### Database Initialization Scripts

```sql
-- ./init-scripts/01-create-databases.sql
CREATE DATABASE opensign;
CREATE DATABASE n8n;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE opensign TO multiapp_user;
GRANT ALL PRIVILEGES ON DATABASE n8n TO multiapp_user;
```

### Crawl4AI Configuration (./crawl4ai-config.yml)

```yaml
app:
  title: "Crawl4AI API"
  version: "1.0.0"
  host: "0.0.0.0"
  port: 11235
  path_prefix: "/crawl4ai"

security:
  enabled: true
  trusted_hosts: ["your-domain.com"]

rate_limiting:
  enabled: true
  default_limit: "100/minute"
  storage_uri: "redis://redis:6379"

logging:
  level: "INFO"
```

## 🚀 Deployment Instructions

### Step 1: Server Setup

```bash
# Create a Digital Ocean droplet (8GB RAM, 4 vCPUs recommended)
# SSH into your server

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again
exit
```

### Step 2: Project Setup

```bash
# Clone this deployment repository
git clone <your-repo-url>
cd multi-app-deployment

# Set up environment variables
cp .env.example .env
nano .env  # Edit with your values

# Create required directories
mkdir -p opensign n8n-data crawl4ai-data init-scripts
```

### Step 3: DNS Configuration

```bash
# Add these DNS records to your domain:
# Type: A, Name: @, Value: YOUR_SERVER_IP
# Type: A, Name: *, Value: YOUR_SERVER_IP
```

### Step 4: Deploy Applications

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## 🔗 Application Access URLs

Once deployed, access your applications at:

- **OpenSign**: `https://your-domain.com/opensign`
- **n8n**: `https://your-domain.com/n8n` 
- **Crawl4AI**: `https://your-domain.com/crawl4ai`
- **Traefik Dashboard**: `http://your-domain.com:8080`

## 🔄 Inter-Application Communication

### OpenSign → n8n Integration

```javascript
// OpenSign webhook to trigger n8n workflow
const triggerN8nWorkflow = async (documentData) => {
  const response = await fetch('http://n8n:5678/webhook/opensign-trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(documentData)
  });
  return response.json();
};
```

### n8n → Crawl4AI Integration

```javascript
// n8n HTTP node configuration to call Crawl4AI
const crawlConfig = {
  url: 'http://crawl4ai:11235/crawl',
  method: 'POST',
  body: {
    urls: ['https://example.com'],
    crawler_config: {
      type: 'CrawlerRunConfig',
      params: { cache_mode: 'bypass' }
    }
  }
};
```

### Crawl4AI → OpenSign Integration

```python
# Python script to send crawled data to OpenSign
import requests

def send_to_opensign(crawled_data):
    response = requests.post(
        'http://opensign:3000/api/documents',
        json={
            'content': crawled_data,
            'source': 'crawl4ai'
        },
        headers={'Content-Type': 'application/json'}
    )
    return response.json()
```

## 📊 Monitoring and Maintenance

### Health Check Endpoints

```bash
# Check application health
curl https://your-domain.com/opensign/health
curl https://your-domain.com/n8n/healthz
curl https://your-domain.com/crawl4ai/health
```

### Backup Script

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
docker exec postgres pg_dumpall -U multiapp_user > "backup_${DATE}.sql"

# Backup volumes
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_${DATE}.tar.gz -C /data .
docker run --rm -v n8n_data:/data -v $(pwd):/backup alpine tar czf /backup/n8n_${DATE}.tar.gz -C /data .
docker run --rm -v opensign_data:/data -v $(pwd):/backup alpine tar czf /backup/opensign_${DATE}.tar.gz -C /data .
```

### Update Script

```bash
#!/bin/bash
# update.sh
docker-compose pull
docker-compose up -d --force-recreate
docker image prune -f
```

## 🔧 Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure no other services are using ports 80, 443, 5432, 6379
2. **Memory Issues**: Monitor with `docker stats` and upgrade server if needed
3. **SSL Certificate Issues**: Check Traefik logs with `docker-compose logs traefik`
4. **Database Connection**: Verify PostgreSQL is running and credentials are correct

### Useful Commands

```bash
# View all logs
docker-compose logs -f

# Restart a specific service
docker-compose restart opensign

# Scale a service
docker-compose up -d --scale crawl4ai=2

# Access database
docker exec -it postgres psql -U multiapp_user -d opensign
```

## 💰 Cost Estimation

**Digital Ocean Droplet (8GB RAM, 4 vCPUs)**: ~$48/month
**Domain**: ~$12/year
**Total Monthly Cost**: ~$50/month

## 🚀 Scaling Options

1. **Horizontal Scaling**: Use Docker Swarm or Kubernetes
2. **Database Scaling**: Move to managed PostgreSQL
3. **Load Balancing**: Add multiple app instances behind Traefik
4. **CDN**: Use Digital Ocean Spaces for static assets

This architecture provides a solid foundation for running all three applications on a single server while maintaining the ability to scale and inter-communicate effectively. 