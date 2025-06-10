# 🚀 Local Development Setup

This guide will help you run the multi-application setup locally on your machine using Docker Desktop.

## Prerequisites

1. **Docker Desktop** ✅ (You already have this installed!)
2. **Git** (if you want to make changes to the code)

## 🏃‍♂️ Quick Start

### Option 1: Using the PowerShell Script (Recommended)
```powershell
.\start-local.ps1
```

### Option 2: Manual Docker Compose
```bash
# Load environment variables and start services
docker-compose -f docker-compose.local.yml up -d --build
```

## 📱 Access Your Applications

Once running, you can access:

| Application | Direct Access | Reverse Proxy | Purpose |
|-------------|---------------|---------------|---------|
| **OpenSign** | http://localhost:8001 | http://localhost/opensign | E-signature platform |
| **n8n** | http://localhost:5678 | http://localhost/n8n | Workflow automation |
| **Crawl4AI** | http://localhost:11235 | http://localhost/crawl4ai | Web crawling API |

## 🔧 Development Tools

| Tool | URL | Credentials |
|------|-----|-------------|
| **Traefik Dashboard** | http://localhost:8080 | None |
| **MinIO Console** | http://localhost:9001 | admin/minioadmin |
| **PostgreSQL** | localhost:5432 | opensign_user/local_password_123 |
| **Redis** | localhost:6379 | None |

## 🛠️ Useful Commands

### Viewing Logs
```bash
# View all service logs
docker-compose -f docker-compose.local.yml logs -f

# View specific service logs
docker-compose -f docker-compose.local.yml logs -f opensign
docker-compose -f docker-compose.local.yml logs -f n8n
docker-compose -f docker-compose.local.yml logs -f crawl4ai
```

### Managing Services
```bash
# Stop all services
docker-compose -f docker-compose.local.yml down

# Restart a specific service
docker-compose -f docker-compose.local.yml restart opensign

# Rebuild a service
docker-compose -f docker-compose.local.yml up -d --build opensign

# Check service status
docker-compose -f docker-compose.local.yml ps
```

### Database Access
```bash
# Connect to PostgreSQL
docker exec -it postgres-local psql -U opensign_user -d opensign

# Connect to Redis
docker exec -it redis-local redis-cli
```

## 🔍 Troubleshooting

### Services Not Starting
1. **Check Docker Desktop is running**
2. **View logs**: `docker-compose -f docker-compose.local.yml logs [service-name]`
3. **Restart Docker Desktop** if needed
4. **Check port conflicts**: Make sure ports 80, 8001, 5678, 11235, 8080, 9000, 9001, 5432, 6379 are not in use

### OpenSign Issues
- **Database connection**: Check if PostgreSQL is running
- **File upload issues**: Check MinIO service and configuration
- **Build failures**: Clear Docker cache: `docker system prune -a`

### n8n Issues
- **Workflow execution**: Check that n8n can reach other services via internal network
- **Webhook URLs**: Use internal service names (e.g., `http://opensign:3000`)

### Crawl4AI Issues
- **Memory issues**: Increase Docker Desktop memory allocation (minimum 4GB recommended)
- **Redis connection**: Ensure Redis service is healthy

## 🔗 Inter-Application Communication

Applications can communicate with each other using internal Docker network:

- **OpenSign**: `http://opensign:3000`
- **n8n**: `http://n8n:5678`
- **Crawl4AI**: `http://crawl4ai:11235`
- **PostgreSQL**: `postgres:5432`
- **Redis**: `redis:6379`
- **MinIO**: `http://minio:9000`

## 🧪 Testing the Setup

1. **OpenSign**: Visit http://localhost:8001 and create an account
2. **n8n**: Visit http://localhost:5678 and create your first workflow
3. **Crawl4AI**: Test API at http://localhost:11235/docs (FastAPI Swagger UI)
4. **Proxy routing**: Test path-based routing at http://localhost/opensign, http://localhost/n8n, http://localhost/crawl4ai

## 📝 Development Notes

- **Data persistence**: All data is stored in Docker volumes and persists between restarts
- **Code changes**: OpenSign builds from source, so code changes require rebuilding the container
- **Environment variables**: Modify `.env.local` for configuration changes
- **Networking**: All services communicate via the `app-network` Docker network

## 🛡️ Security Notes

- **Local development only**: This setup uses default credentials and is not secure for production
- **File storage**: Uses MinIO instead of AWS S3 for local development
- **SSL disabled**: All connections are HTTP for simplicity

## 🚀 Next Steps

1. **Customize configuration**: Edit `.env.local` with your preferred settings
2. **Add your own workflows**: Create n8n workflows that integrate with OpenSign and Crawl4AI
3. **Extend functionality**: Add your own services to the docker-compose.local.yml file
4. **Deploy to production**: Use `docker-compose.yml` for production deployment with SSL 