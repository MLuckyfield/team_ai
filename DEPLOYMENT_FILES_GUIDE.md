# 📁 Deployment Files Guide

## 🎯 **MAIN DEPLOYMENT FILE**

### ✅ **USE THIS FILE:**
- **`multi-app-platform.yaml`** - Complete multi-service deployment (OpenSign + n8n + Crawl4AI)

## 📋 **File Breakdown**

| File | Purpose | Status | Action |
|------|---------|--------|--------|
| **`multi-app-platform.yaml`** | ✅ **Main deployment file** | **ACTIVE** | **USE THIS** |
| `crawl4ai-app.yaml` | Individual Crawl4AI app | Legacy | Keep for reference |
| `n8n-app.yaml` | Individual n8n app | Legacy | Keep for reference |
| `opensign-app.yaml` | Individual OpenSign app | Legacy | Keep for reference |
| `docker-compose.yml` | Local Docker development | Development | For local testing only |
| `docker-compose.local.yml` | Local Docker development | Development | For local testing only |
| `crawl4ai-config.yml` | Crawl4AI configuration | Config | Used by Crawl4AI service |

## 🚀 **Deployment Instructions**

### **For Digital Ocean App Platform:**

1. **Use:** `multi-app-platform.yaml`
2. **Method:** Upload this file in DO App Platform dashboard
3. **Result:** All 3 apps deployed at different paths on same domain

### **Deployment Steps:**

```bash
# Option A: CLI Deployment
doctl apps create --spec multi-app-platform.yaml

# Option B: Dashboard Deployment
# 1. Go to DO App Platform
# 2. Click "Create App" 
# 3. Choose "Import from YAML"
# 4. Upload multi-app-platform.yaml
# 5. Configure environment variables
# 6. Deploy
```

## 🔧 **Key Features of multi-app-platform.yaml**

- ✅ **OpenSign**: Uses `opensignlabs/opensign` Docker image
- ✅ **n8n**: Uses `docker.n8n.io/n8nio/n8n` Docker image  
- ✅ **Crawl4AI**: Uses `unclecode/crawl4ai` Docker image
- ✅ **Landing Page**: Built from your repository
- ✅ **Databases**: PostgreSQL for OpenSign + n8n, Redis for Crawl4AI
- ✅ **Path Routing**: `/opensign`, `/n8n`, `/crawl4ai`, `/`

## ⚠️ **Important Notes**

1. **No component detection issues** - Uses Docker images, not source builds
2. **Faster deployment** - Pre-built images download quickly
3. **More reliable** - Official images maintained by each project
4. **Single domain** - All apps accessible from one URL with different paths

## 🎛️ **Environment Variables Required**

Set these in Digital Ocean App Platform dashboard:

```bash
# Required for OpenSign
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=your-opensign-bucket

# Optional for Crawl4AI
OPENAI_API_KEY=sk-your_openai_key
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
```

## 🔗 **Expected URLs After Deployment**

- **Landing Page**: `https://your-app.ondigitalocean.app/`
- **OpenSign**: `https://your-app.ondigitalocean.app/opensign`
- **n8n**: `https://your-app.ondigitalocean.app/n8n`
- **Crawl4AI**: `https://your-app.ondigitalocean.app/crawl4ai`

---

## 🗂️ **Legacy Files (For Reference Only)**

The individual app YAML files are kept for reference but **should not be used** for the multi-service deployment:

- `crawl4ai-app.yaml` - Individual Crawl4AI deployment
- `n8n-app.yaml` - Individual n8n deployment  
- `opensign-app.yaml` - Individual OpenSign deployment

These would create **separate apps** instead of the unified multi-service approach. 