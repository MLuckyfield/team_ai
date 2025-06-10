# Multi-Application Deployment

Deploy **OpenSign**, **n8n**, and **Crawl4AI** on a single Digital Ocean server with path-based routing, SSL certificates, and inter-application communication.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Digital Ocean Droplet                    │
│                    (8GB RAM, 4 vCPUs)                      │
├─────────────────────────────────────────────────────────────┤
│                      Traefik Proxy                         │
│                 (SSL + Path Routing)                       │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │ /opensign/*  │ /n8n/*       │ /crawl4ai/*              │ │
│  └──────────────┴──────────────┴──────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  OpenSign   │ │     n8n     │ │       Crawl4AI          │ │
│  │   :3000     │ │   :5678     │ │       :11235            │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         PostgreSQL (OpenSign metadata only)            │ │
│  │                   :5432                                 │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            Redis (Crawl4AI cache)                      │ │
│  │                   :6379                                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

          ☁️ AWS S3 (OpenSign file storage)
          📁 Local volumes (n8n workflows)
```

## 🗃️ **Corrected Database Architecture**

| Application | Database Needs | Storage Solution |
|-------------|----------------|------------------|
| **OpenSign** | ✅ PostgreSQL (metadata) | AWS S3 (documents/files) |
| **n8n** | ❌ No database | SQLite files (workflows) |
| **Crawl4AI** | ❌ No database | Redis (caching only) |

## 🚀 Quick Start

### Prerequisites

- Digital Ocean Droplet (8GB RAM, 4 vCPUs recommended)
- Domain name with DNS pointing to your server
- **AWS S3 bucket** for OpenSign file storage
- SSH access to your server

### 1. Clone and Setup

```bash
# Clone this repository
git clone <your-repo-url>
cd multi-app-deployment

# Interactive setup (recommended)
./setup.ps1  # Windows
# OR manually copy and edit
cp env.example .env
nano .env  # Edit with your domain, AWS credentials, etc.
```

### 2. Deploy Everything

```bash
# Windows PowerShell
.\scripts\deploy.ps1

# Linux/macOS
./scripts/deploy.sh
```

### 3. Access Applications

After deployment (allow 2-3 minutes for SSL certificates):

- **🔐 OpenSign**: `https://your-domain.com/opensign`
- **🔄 n8n**: `https://your-domain.com/n8n`
- **🕷️ Crawl4AI**: `https://your-domain.com/crawl4ai`
- **📊 Traefik Dashboard**: `http://your-domain.com:8080`

## 📦 What's Included

### Applications

| Application | Description | Port | Path | Database | File Storage |
|-------------|-------------|------|------|----------|--------------|
| **OpenSign** | E-signature platform | 3000 | `/opensign` | PostgreSQL | AWS S3 |
| **n8n** | Workflow automation | 5678 | `/n8n` | SQLite files | Local volumes |
| **Crawl4AI** | AI web crawler | 11235 | `/crawl4ai` | None | Redis cache |

### Infrastructure

- **Traefik**: Reverse proxy with automatic SSL certificates
- **PostgreSQL**: Database for OpenSign metadata only
- **Redis**: Cache for Crawl4AI
- **AWS S3**: File storage for OpenSign documents
- **Docker Compose**: Container orchestration

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# Domain Configuration
DOMAIN=your-domain.com
SSL_EMAIL=your-email@domain.com

# Database Configuration (OpenSign only)
DB_USER=opensign_user
DB_PASSWORD=your_secure_password

# AWS S3 Configuration (OpenSign file storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-opensign-bucket

# API Keys (Optional for Crawl4AI)
OPENAI_API_KEY=sk-your_openai_key
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
```

### AWS S3 Setup

1. **Create S3 Bucket**:
   ```bash
   aws s3 mb s3://your-opensign-bucket
   ```

2. **Set Bucket Policy** (example):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {"AWS": "arn:aws:iam::YOUR-ACCOUNT:user/opensign-user"},
         "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::your-opensign-bucket/*"
       }
     ]
   }
   ```

### DNS Configuration

Add these records to your domain:

```
Type: A, Name: @, Value: YOUR_SERVER_IP
Type: A, Name: *, Value: YOUR_SERVER_IP
```

## 🔗 Inter-Application Communication

The applications can communicate with each other using internal Docker network addresses:

### OpenSign → n8n
```javascript
// Trigger n8n workflow from OpenSign
const response = await fetch('http://n8n:5678/webhook/opensign-trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(documentData)
});
```

### n8n → Crawl4AI
```javascript
// Call Crawl4AI from n8n HTTP node
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

### Crawl4AI → OpenSign
```python
# Send crawled data to OpenSign
import requests

response = requests.post(
    'http://opensign:3000/api/documents',
    json={'content': crawled_data, 'source': 'crawl4ai'}
)
```

## 🛠️ Management Scripts

### Deployment
```bash
./setup.ps1           # Interactive setup (Windows)
./scripts/deploy.ps1  # Deploy (Windows)
./scripts/deploy.sh   # Deploy (Linux/macOS)
```

### Maintenance
```bash
./scripts/backup.sh      # Create backup
./scripts/update.sh      # Update all services
./scripts/monitor.sh     # Check system status
```

### Manual Operations
```bash
# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]

# Scale a service
docker-compose up -d --scale crawl4ai=2

# Stop everything
docker-compose down

# Start everything
docker-compose up -d
```

## 📊 Monitoring

### Health Checks

All services include health checks accessible at:

- OpenSign: `https://your-domain.com/opensign/health`
- n8n: `https://your-domain.com/n8n/healthz`
- Crawl4AI: `https://your-domain.com/crawl4ai/health`

### System Monitoring

```bash
# Real-time monitoring
./scripts/monitor.sh

# Resource usage
docker stats

# Service status
docker-compose ps
```

## 🔒 Security Features

- **SSL/TLS**: Automatic certificates via Let's Encrypt
- **AWS S3**: Secure file storage with IAM policies
- **Network Isolation**: Internal Docker network for service communication
- **Rate Limiting**: Built-in rate limiting for Crawl4AI
- **Database Security**: Isolated database with separate credentials

## 💾 Backup & Recovery

### Automated Backups

```bash
# Create full backup
./scripts/backup.sh

# Backups include:
# - PostgreSQL database (OpenSign metadata)
# - n8n workflow files
# - Crawl4AI cache data
# - SSL certificates
# Note: S3 files should be backed up separately via AWS
```

### Restore Process

```bash
# Stop services
docker-compose down

# Restore volumes from backup
docker run --rm -v postgres_data:/data -v $(pwd)/backups/backup_DATE:/backup alpine sh -c "cd /data && tar xzf /backup/postgres_data.tar.gz"

# Restart services
docker-compose up -d
```

## 💰 Cost Estimation

| Component | Monthly Cost |
|-----------|-------------|
| Digital Ocean Droplet (8GB) | ~$48 |
| AWS S3 Storage (estimated) | ~$5-20 |
| Domain Registration | ~$1 |
| **Total** | **~$54-69/month** |

## 🚀 Scaling Options

### Vertical Scaling
- Upgrade to larger Digital Ocean droplet
- Increase CPU/RAM as needed

### Horizontal Scaling
```bash
# Scale specific services
docker-compose up -d --scale crawl4ai=3
```

### Advanced Scaling
- Docker Swarm for multi-node deployment
- Kubernetes for enterprise scale
- AWS RDS for managed PostgreSQL

## 🔧 Troubleshooting

### Common Issues

**SSL Certificate Issues**
```bash
# Check Traefik logs
docker-compose logs traefik

# Force certificate renewal
docker-compose restart traefik
```

**S3 Connection Issues**
```bash
# Check OpenSign logs
docker-compose logs opensign

# Verify AWS credentials
aws s3 ls s3://your-opensign-bucket
```

**Service Not Accessible**
```bash
# Check service status
docker-compose ps

# Check service logs
docker-compose logs [service-name]

# Restart service
docker-compose restart [service-name]
```

**Database Connection Issues**
```bash
# Check PostgreSQL status
docker exec postgres pg_isready -U opensign_user

# Access database directly
docker exec -it postgres psql -U opensign_user -d opensign
```

### Log Analysis

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f opensign

# Follow logs in real-time
docker-compose logs --tail=100 -f
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Test your changes thoroughly
4. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Create an issue for bug reports
- Check the troubleshooting section
- Review Docker Compose logs for errors
- Monitor system resources with included scripts

---

**Ready to deploy?** Run `./setup.ps1` for interactive setup, then `./scripts/deploy.ps1`! 