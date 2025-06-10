# 🚀 Quick Reference - Local Multi-App Setup

## 📱 **Application URLs**

| Service | Direct URL | Via Proxy | Purpose |
|---------|------------|-----------|---------|
| **📝 OpenSign** | http://localhost:8001 | http://localhost/opensign | E-signature platform |
| **⚡ n8n** | http://localhost:5678 | http://localhost/n8n | Workflow automation |
| **🕷️ Crawl4AI** | http://localhost:11235 | http://localhost/crawl4ai | Web scraping API |
| **🕷️ Crawl4AI Docs** | http://localhost:11235/docs | http://localhost/crawl4ai/docs | API documentation |

## 🛠️ **Development Tools**

| Tool | URL | Login |
|------|-----|-------|
| **🔗 Traefik Dashboard** | http://localhost:8080 | None |
| **📦 MinIO Console** | http://localhost:9001 | admin/minioadmin |
| **🗃️ PostgreSQL** | localhost:5432 | opensign_user/local_password_123 |
| **🔴 Redis** | localhost:6379 | None |

---

## 🐳 **Docker Commands**

### **🎬 Starting & Stopping**
```powershell
# Start all services
.\start-local.ps1
# OR
docker-compose -f docker-compose.local.yml up -d

# Stop all services
docker-compose -f docker-compose.local.yml down

# Restart all services
docker-compose -f docker-compose.local.yml restart

# Check service status
docker-compose -f docker-compose.local.yml ps
```

### **📋 Viewing Logs**

#### **All Services**
```powershell
# View recent logs from all services
docker-compose -f docker-compose.local.yml logs --tail=20

# Follow all logs in real-time
docker-compose -f docker-compose.local.yml logs -f
```

#### **Individual Service Logs**
```powershell
# OpenSign
docker-compose -f docker-compose.local.yml logs opensign
docker-compose -f docker-compose.local.yml logs -f opensign

# n8n
docker-compose -f docker-compose.local.yml logs n8n
docker-compose -f docker-compose.local.yml logs -f n8n

# Crawl4AI
docker-compose -f docker-compose.local.yml logs crawl4ai
docker-compose -f docker-compose.local.yml logs -f crawl4ai

# Traefik (Reverse Proxy)
docker-compose -f docker-compose.local.yml logs traefik
docker-compose -f docker-compose.local.yml logs -f traefik

# PostgreSQL
docker-compose -f docker-compose.local.yml logs postgres

# Redis
docker-compose -f docker-compose.local.yml logs redis

# MinIO
docker-compose -f docker-compose.local.yml logs minio
```

### **🔄 Individual Service Management**
```powershell
# Restart a specific service
docker-compose -f docker-compose.local.yml restart opensign
docker-compose -f docker-compose.local.yml restart n8n
docker-compose -f docker-compose.local.yml restart crawl4ai

# Rebuild and restart a service
docker-compose -f docker-compose.local.yml up -d --build opensign

# Stop a specific service
docker-compose -f docker-compose.local.yml stop opensign

# Start a specific service
docker-compose -f docker-compose.local.yml start opensign
```

---

## 🚨 **Troubleshooting**

### **n8n Not Loading Properly (Black Screen with Console Errors)?**
```powershell
# If n8n shows a blank page with CSS/JS errors, recreate the container:
docker-compose -f docker-compose.local.yml stop n8n
docker-compose -f docker-compose.local.yml rm -f n8n
docker-compose -f docker-compose.local.yml up -d n8n
```

### **Service Not Loading?**
1. **Check if running**: `docker-compose -f docker-compose.local.yml ps`
2. **View logs**: `docker-compose -f docker-compose.local.yml logs [service-name]`
3. **Restart service**: `docker-compose -f docker-compose.local.yml restart [service-name]`

### **OpenSign Taking Forever?**
```powershell
# Check OpenSign build process
docker-compose -f docker-compose.local.yml logs -f opensign
```

### **Port Conflicts?**
```powershell
# Stop everything and restart
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.local.yml up -d
```

### **Clear Everything & Start Fresh**
```powershell
# Nuclear option - removes all containers and networks
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.local.yml up -d --build
```

---

## 💡 **Pro Tips**

### **Useful Flags**
- **`-f`** = Follow logs in real-time
- **`--tail=50`** = Show last 50 lines only
- **`-d`** = Run in background (detached)
- **`--build`** = Rebuild containers

### **Quick Health Check**
```powershell
# See all containers and their status
docker ps

# See detailed service status
docker-compose -f docker-compose.local.yml ps
```

### **Database Access**
```powershell
# Connect to PostgreSQL
docker exec -it postgres-local psql -U opensign_user -d opensign

# Connect to Redis
docker exec -it redis-local redis-cli
```

---

## 🔗 **Quick Links**
- **OpenSign**: http://localhost:8001
- **n8n**: http://localhost:5678  
- **Crawl4AI**: http://localhost:11235/docs
- **Traefik**: http://localhost:8080
- **MinIO**: http://localhost:9001

**Remember**: Press `Ctrl+C` to stop following logs! 