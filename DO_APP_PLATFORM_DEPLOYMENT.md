# Digital Ocean App Platform Multi-Service Deployment

This guide explains how to deploy OpenSign, n8n, and Crawl4AI as a single application on Digital Ocean App Platform, accessible at different URL paths.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                Digital Ocean App Platform                   │
│                    multi-app-platform                       │
├─────────────────────────────────────────────────────────────┤
│                     Load Balancer                          │
│                   (SSL Termination)                        │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │ /opensign/*  │ /n8n/*       │ /crawl4ai/*              │ │
│  │              │              │                          │ │
│  └──────────────┴──────────────┴──────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  OpenSign   │ │     n8n     │ │       Crawl4AI          │ │
│  │  Service    │ │   Service   │ │       Service           │ │
│  │  :8080      │ │   :8080     │ │       :8080             │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              PostgreSQL Databases                      │ │
│  │         opensign-db  |  shared-db (n8n)               │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                Redis (Crawl4AI)                        │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

          ☁️ AWS S3 (OpenSign file storage)
```

## 📦 Services Overview

| Service | URL Path | Description | Database | External Storage |
|---------|----------|-------------|----------|------------------|
| **Landing** | `/` | Landing page with app links | None | None |
| **OpenSign** | `/opensign` | E-signature platform | PostgreSQL | AWS S3 |
| **n8n** | `/n8n` | Workflow automation | PostgreSQL | None |
| **Crawl4AI** | `/crawl4ai` | AI web crawler | None | Redis cache |

## 🚀 Deployment Steps

### 1. Prerequisites

- Digital Ocean account with App Platform access
- GitHub repository with your code
- AWS S3 bucket for OpenSign file storage
- API keys for OpenAI/Anthropic (optional for Crawl4AI)

### 2. Deploy Using App Platform

#### Option A: Using Digital Ocean CLI (doctl)

```bash
# Install doctl if not already installed
# https://docs.digitalocean.com/reference/doctl/how-to/install/

# Authenticate with your DO account
doctl auth init

# Deploy the app
doctl apps create --spec multi-app-platform.yaml
```

#### Option B: Using Digital Ocean Dashboard

1. Go to [Digital Ocean App Platform](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Choose "Import from YAML"
4. Upload `multi-app-platform.yaml`
5. Configure environment variables (see section below)
6. Deploy

### 3. Configure Environment Variables

In the App Platform dashboard, set these environment variables:

#### Required Variables
```bash
# AWS S3 Configuration (for OpenSign)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=your-opensign-bucket

# AI API Keys (optional for Crawl4AI)
OPENAI_API_KEY=sk-your_openai_key
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
```

### 4. Post-Deployment Configuration

#### A. Database Setup

The databases will be automatically created, but you may need to initialize schemas:

**For n8n database:**
- n8n will automatically create its schema on first run
- No manual setup required

**For OpenSign database:**
- OpenSign will run migrations on startup
- Ensure the DATABASE_URL environment variable is properly set

#### B. First-Time Access

After deployment (allow 5-10 minutes for full startup):

1. **Landing Page**: `https://your-app-domain.ondigitalocean.app/`
2. **OpenSign**: `https://your-app-domain.ondigitalocean.app/opensign`
3. **n8n**: `https://your-app-domain.ondigitalocean.app/n8n`
4. **Crawl4AI**: `https://your-app-domain.ondigitalocean.app/crawl4ai`

## 🔧 Configuration Details

### Service Communication

Services can communicate with each other using internal URLs:

```javascript
// From any service, call another service
const response = await fetch('http://n8n:8080/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

### Resource Allocation

| Service | Instance Size | CPU | RAM | Cost Impact |
|---------|---------------|-----|-----|-------------|
| OpenSign | basic-s | 1 vCPU | 1GB | Medium |
| n8n | basic-s | 1 vCPU | 1GB | Medium |
| Crawl4AI | basic-s | 1 vCPU | 1GB | Medium |
| Landing | basic-xxs | 0.25 vCPU | 256MB | Low |

**Total estimated cost**: ~$50-70/month (plus database/Redis costs)

### Database Configuration

- **opensign-db**: PostgreSQL basic-xs (~$15/month)
- **shared-db**: PostgreSQL basic-xs for n8n (~$15/month)  
- **shared-redis**: Redis basic-xs for Crawl4AI (~$15/month)

## 🔄 Updates and Maintenance

### Updating Applications

1. **Push code changes to GitHub**
2. **Trigger redeploy** in App Platform dashboard
3. **Monitor deployment** logs for any issues

### Scaling

Individual services can be scaled independently:

```bash
# Scale n8n service to 2 instances
doctl apps update YOUR_APP_ID --spec updated-multi-app-platform.yaml
```

### Monitoring

- **App Platform Dashboard**: Monitor resource usage and logs
- **Database Metrics**: Monitor database performance
- **Application Logs**: Each service has separate log streams

## 🚨 Troubleshooting

### Common Issues

1. **Service not accessible**
   - Check if the route path is configured correctly
   - Verify the service is listening on port 8080
   - Check service logs for startup errors

2. **Database connection issues**
   - Verify DATABASE_URL environment variables
   - Check database service status
   - Ensure database migrations have run

3. **OpenSign file upload issues**
   - Verify AWS S3 credentials and bucket permissions
   - Check S3 bucket CORS configuration

4. **Inter-service communication issues**
   - Use internal service names (e.g., `http://n8n:8080`)
   - Ensure services are in the same app

### Debugging Commands

```bash
# Get app info
doctl apps get YOUR_APP_ID

# View logs for specific service
doctl apps logs YOUR_APP_ID --component n8n

# Get deployment status
doctl apps list-deployments YOUR_APP_ID
```

## 📋 Checklist

- [ ] Repository configured with proper build commands
- [ ] AWS S3 bucket created and configured
- [ ] Environment variables set in App Platform
- [ ] YAML file deployed successfully
- [ ] All services accessible at their paths
- [ ] Database connections working
- [ ] File uploads working (OpenSign)
- [ ] Inter-service communication tested

## 🔗 Useful Links

- [Digital Ocean App Platform Documentation](https://docs.digitalocean.com/products/app-platform/)
- [App Platform YAML Reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [doctl CLI Reference](https://docs.digitalocean.com/reference/doctl/)

## 💡 Benefits of This Approach

1. **Cost Effective**: Single app platform deployment vs. three separate apps
2. **Simplified Management**: One deployment, one dashboard, one domain
3. **Shared Resources**: Databases and Redis shared across services
4. **Easy Inter-app Communication**: Services can communicate internally
5. **Unified SSL**: Single SSL certificate covers all services
6. **Path-based Routing**: Clean URLs with logical path separation 