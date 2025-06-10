#!/bin/bash

# Backup script for multi-app deployment
# Creates backups of PostgreSQL databases and Docker volumes

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}📦 Starting backup process...${NC}"

# Create backup directory with timestamp
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/backup_${DATE}"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📁 Backup directory: $BACKUP_DIR${NC}"

# Source environment variables
if [ -f .env ]; then
    source .env
else
    echo "Warning: .env file not found, using default values"
    DB_USER="multiapp_user"
fi

# Backup PostgreSQL databases
echo -e "${YELLOW}🗄️  Backing up PostgreSQL databases...${NC}"
docker exec postgres pg_dump -U "$DB_USER" -d opensign > "$BACKUP_DIR/opensign_db.sql"
docker exec postgres pg_dump -U "$DB_USER" -d n8n > "$BACKUP_DIR/n8n_db.sql"
docker exec postgres pg_dumpall -U "$DB_USER" > "$BACKUP_DIR/all_databases.sql"

# Backup Docker volumes
echo -e "${YELLOW}💾 Backing up Docker volumes...${NC}"

# Backup PostgreSQL data
docker run --rm -v postgres_data:/data -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .

# Backup Redis data
docker run --rm -v redis_data:/data -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/redis_data.tar.gz -C /data .

# Backup n8n data
docker run --rm -v n8n_data:/data -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/n8n_data.tar.gz -C /data .

# Backup OpenSign data
docker run --rm -v opensign_data:/data -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/opensign_data.tar.gz -C /data .

# Backup Crawl4AI data
docker run --rm -v crawl4ai_data:/data -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/crawl4ai_data.tar.gz -C /data .

# Backup Traefik data (SSL certificates)
docker run --rm -v traefik_data:/data -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/traefik_data.tar.gz -C /data .

# Create backup info file
cat > "$BACKUP_DIR/backup_info.txt" << EOF
Backup created: $(date)
Domain: ${DOMAIN:-"not set"}
Database User: ${DB_USER}
Services included:
- PostgreSQL (opensign, n8n databases)
- Redis
- n8n workflows and settings
- OpenSign documents and data
- Crawl4AI data and cache
- Traefik SSL certificates

Files:
- opensign_db.sql (OpenSign database dump)
- n8n_db.sql (n8n database dump)
- all_databases.sql (Complete database dump)
- postgres_data.tar.gz (PostgreSQL volume)
- redis_data.tar.gz (Redis volume)
- n8n_data.tar.gz (n8n volume)
- opensign_data.tar.gz (OpenSign volume)
- crawl4ai_data.tar.gz (Crawl4AI volume)
- traefik_data.tar.gz (Traefik volume with SSL certs)
EOF

# Create compressed archive of entire backup
echo -e "${YELLOW}🗜️  Creating compressed backup archive...${NC}"
tar czf "backups/complete_backup_${DATE}.tar.gz" -C "$BACKUP_DIR" .

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
ARCHIVE_SIZE=$(du -sh "backups/complete_backup_${DATE}.tar.gz" | cut -f1)

echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo "Backup directory: $BACKUP_DIR (Size: $BACKUP_SIZE)"
echo "Compressed archive: backups/complete_backup_${DATE}.tar.gz (Size: $ARCHIVE_SIZE)"

# Cleanup old backups (keep last 7 days)
echo -e "${YELLOW}🧹 Cleaning up old backups...${NC}"
find ./backups -name "backup_*" -type d -mtime +7 -exec rm -rf {} +
find ./backups -name "complete_backup_*.tar.gz" -mtime +7 -delete

echo -e "${GREEN}📦 Backup process completed!${NC}" 