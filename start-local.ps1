#!/usr/bin/env pwsh

# Multi-App Local Development Starter
# This script starts all three applications locally using Docker Compose

Write-Host "🚀 Starting Multi-App Local Development Environment..." -ForegroundColor Green
Write-Host ""

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Load environment variables
if (Test-Path ".env.local") {
    Write-Host "📋 Loading local environment variables..." -ForegroundColor Yellow
    Get-Content ".env.local" | Where-Object { $_ -notmatch '^#' -and $_ -ne '' } | ForEach-Object {
        $key, $value = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
} else {
    Write-Host "⚠️  No .env.local file found. Using default values." -ForegroundColor Yellow
}

# Stop any existing containers
Write-Host "🛑 Stopping any existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.local.yml down 2>$null

# Pull latest images
Write-Host "📥 Pulling latest Docker images..." -ForegroundColor Yellow
docker-compose -f docker-compose.local.yml pull

# Start the services
Write-Host "🏗️  Building and starting all services..." -ForegroundColor Green
Write-Host "This may take a few minutes for the first run..." -ForegroundColor Yellow
docker-compose -f docker-compose.local.yml up -d --build

# Wait for services to be ready
Write-Host ""
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Check service status
Write-Host ""
Write-Host "📊 Service Status:" -ForegroundColor Green
docker-compose -f docker-compose.local.yml ps

Write-Host ""
Write-Host "🎉 Local Development Environment Started!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Access your applications:" -ForegroundColor Cyan
Write-Host "  🔗 Traefik Dashboard: http://localhost:8080" -ForegroundColor White
Write-Host "  📝 OpenSign:         http://localhost:8001 (direct) or http://localhost/opensign (proxy)" -ForegroundColor White
Write-Host "  ⚡ n8n:             http://localhost:5678 (direct) or http://localhost/n8n (proxy)" -ForegroundColor White
Write-Host "  🕷️  Crawl4AI:        http://localhost:11235 (direct) or http://localhost/crawl4ai (proxy)" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Development Tools:" -ForegroundColor Cyan
Write-Host "  📊 MinIO Console:    http://localhost:9001 (admin/minioadmin)" -ForegroundColor White
Write-Host "  🗃️  PostgreSQL:      localhost:5432 (opensign_user/local_password_123)" -ForegroundColor White
Write-Host "  🔴 Redis:           localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "📝 Useful Commands:" -ForegroundColor Cyan
Write-Host "  View logs:          docker-compose -f docker-compose.local.yml logs -f [service]" -ForegroundColor White
Write-Host "  Stop all:           docker-compose -f docker-compose.local.yml down" -ForegroundColor White
Write-Host "  Restart service:    docker-compose -f docker-compose.local.yml restart [service]" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Cyan
Write-Host "  - Services may take 1-2 minutes to fully initialize" -ForegroundColor White
Write-Host "  - Use direct ports for development, proxy paths for testing routing" -ForegroundColor White
Write-Host "  - Check logs if services don't respond: docker-compose -f docker-compose.local.yml logs [service]" -ForegroundColor White
Write-Host "" 