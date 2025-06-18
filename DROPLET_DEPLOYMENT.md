# n8n + PostgreSQL Droplet Deployment

This deployment configuration runs n8n with PostgreSQL on a DigitalOcean Droplet, providing persistent data storage and cost-effective hosting.

## 📋 Prerequisites

- DigitalOcean Droplet (minimum: 1GB RAM, 1 vCPU)
- Ubuntu 20.04+ or similar Linux distribution
- Domain name (optional, for SSL)
- SSH access to your Droplet

## 💰 Cost Comparison

| Solution | Monthly Cost | Storage | Scalability |
|----------|--------------|---------|-------------|
| **Droplet** | ~$6/month | Persistent SSD | Manual scaling |
| App Platform + PostgreSQL | ~$35/month | Managed | Auto-scaling |

## 🚀 Quick Start

### 1. Create a DigitalOcean Droplet

1. Go to DigitalOcean Console
2. Create Droplet → Ubuntu 22.04 LTS
3. Choose size: Basic ($6/month - 1GB RAM, 1 vCPU)
4. Add your SSH key
5. Create Droplet

### 2. Upload Files to Droplet

```bash
# From your local machine, upload the files
scp docker-compose.droplet.yml root@YOUR_DROPLET_IP:~/
scp init-db.sql root@YOUR_DROPLET_IP:~/
scp nginx.conf root@YOUR_DROPLET_IP:~/
scp env.droplet.template root@YOUR_DROPLET_IP:~/
scp deploy-droplet.sh root@YOUR_DROPLET_IP:~/
```

### 3. Deploy on Droplet

```bash
# SSH into your Droplet
ssh root@YOUR_DROPLET_IP

# Make the script executable
chmod +x deploy-droplet.sh

# Run the deployment script
sudo ./deploy-droplet.sh
```

### 4. Configure Environment Variables

The script will prompt you to edit `.env` file:

```bash
nano /opt/n8n/.env
```

**Required changes:**
- `POSTGRES_PASSWORD`: Set a secure password
- `N8N_ENCRYPTION_KEY`: Generate a secure 32+ character key
- `N8N_HOST`: Your domain name (or IP for development)
- `WEBHOOK_URL`: Your webhook URL
- API keys for AI features (optional)

### 5. Start Services

```bash
cd /opt/n8n
docker-compose up -d
```

## 🌍 Access Your n8n Instance

- **Development**: `http://YOUR_DROPLET_IP:5678`
- **Production**: Configure domain and SSL (see below)

## 🔒 Production Setup with SSL

### 1. Point Domain to Droplet
- Configure your domain's A record to point to your Droplet's IP

### 2. Obtain SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
apt install certbot

# Get certificate (replace with your domain)
certbot certonly --standalone -d your-domain.com

# Copy certificates to nginx directory
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/n8n/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/n8n/ssl/key.pem
```

### 3. Update Environment Variables

```bash
cd /opt/n8n
nano .env
```

Update:
```env
N8N_HOST=your-domain.com
N8N_PROTOCOL=https
WEBHOOK_URL=https://your-domain.com
```

### 4. Start with SSL

```bash
docker-compose --profile production up -d
```

## 📊 Monitoring & Management

### View Logs
```bash
cd /opt/n8n
docker-compose logs -f n8n        # n8n logs
docker-compose logs -f postgres   # PostgreSQL logs
```

### Restart Services
```bash
docker-compose restart
```

### Update n8n
```bash
docker-compose pull
docker-compose up -d
```

### Backup Database
```bash
# Create backup
docker exec n8n_postgres pg_dump -U n8n n8n > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker exec -i n8n_postgres psql -U n8n -d n8n < backup_file.sql
```

## 🛠 Troubleshooting

### Services Won't Start
```bash
# Check service status
docker-compose ps

# View detailed logs
docker-compose logs

# Check disk space
df -h

# Check memory usage
free -h
```

### Database Connection Issues
```bash
# Test PostgreSQL connection
docker exec n8n_postgres psql -U n8n -d n8n -c "SELECT version();"

# Check PostgreSQL logs
docker-compose logs postgres
```

### Port Issues
```bash
# Check if ports are open
netstat -tlnp | grep :5678
netstat -tlnp | grep :5432

# Check firewall status
ufw status
```

### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in /opt/n8n/ssl/cert.pem -text -noout

# Renew Let's Encrypt certificate
certbot renew
```

## 🔧 Configuration Files

### docker-compose.droplet.yml
Main orchestration file defining:
- PostgreSQL service with persistent storage
- n8n service with database connection
- Nginx reverse proxy (production profile)
- Health checks and networking

### init-db.sql
PostgreSQL initialization script:
- Creates n8n database
- Sets up user permissions
- Installs required extensions

### nginx.conf
Reverse proxy configuration:
- SSL termination
- Security headers
- Proper proxy settings for n8n

### env.droplet.template
Environment variables template:
- Database configuration
- n8n settings
- Security keys
- API keys

## 🔄 Migration from App Platform

To migrate your existing workflows and credentials:

1. **Export from App Platform n8n:**
   - Go to Settings → Import/Export
   - Export workflows and credentials

2. **Import to Droplet n8n:**
   - Access your new Droplet n8n instance
   - Go to Settings → Import/Export
   - Import your exported files

## 📈 Scaling Considerations

### Vertical Scaling (Upgrade Droplet)
- Monitor CPU and RAM usage
- Upgrade to larger Droplet size when needed

### Horizontal Scaling
- Use external PostgreSQL (e.g., DigitalOcean Managed Database)
- Load balancer for multiple n8n instances

### Performance Optimization
- Regular database maintenance
- Monitor execution history cleanup
- Optimize workflow designs

## 💡 Tips

1. **Regular Backups**: Set up automated database backups
2. **Monitoring**: Use DigitalOcean Monitoring or external tools
3. **Updates**: Keep n8n and system packages updated
4. **Security**: Regular security updates and strong passwords
5. **Cost Optimization**: Monitor resource usage and scale appropriately

## 🆘 Support

For issues specific to this deployment:
1. Check the troubleshooting section above
2. Review Docker and n8n logs
3. Verify network connectivity and firewall settings

For n8n-specific issues:
- [n8n Documentation](https://docs.n8n.io/)
- [n8n Community](https://community.n8n.io/)
- [n8n GitHub](https://github.com/n8n-io/n8n) 