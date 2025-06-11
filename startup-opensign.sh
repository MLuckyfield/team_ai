#!/bin/bash

echo "Starting unified platform with OpenSign..."

# Remove any stale supervisor socket
rm -f /var/run/supervisor.sock

# Create necessary directories
mkdir -p /var/log/supervisor /var/run/supervisor /var/log/nginx /var/lib/mongodb /var/log/mongodb

# Set proper permissions
chmod 755 /var/log/supervisor /var/run/supervisor /var/log/nginx /var/lib/mongodb /var/log/mongodb
chown mongodb:mongodb /var/lib/mongodb /var/log/mongodb

# Initialize MongoDB if needed
if [ ! -f /var/lib/mongodb/.initialized ]; then
    echo "Initializing MongoDB..."
    touch /var/lib/mongodb/.initialized
fi

# Install serve globally for serving React build
npm install -g serve

# Configure OpenSign environment
cd /opensign
if [ ! -f .env.prod ]; then
    echo "Creating OpenSign .env.prod..."
    cat > .env.prod << EOF
PUBLIC_URL=https://unified-minimal-platform-5p64u.ondigitalocean.app/opensign/
MASTER_KEY=XnAadwKxxByMr
MONGODB_URI=mongodb://localhost:27017/OpenSignDB
PARSE_MOUNT=/app
SERVER_URL=http://localhost:1337/app
USE_LOCAL=true
APP_ID=opensign
EOF
fi

echo "Starting all services..."

# Start supervisord
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf 