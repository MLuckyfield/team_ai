#!/bin/bash

echo "Starting unified minimal platform..."

# Remove any stale supervisor socket
rm -f /var/run/supervisor.sock

# Create necessary directories
mkdir -p /var/log/supervisor /var/run/supervisor /var/log/nginx

# Set proper permissions
chmod 755 /var/log/supervisor /var/run/supervisor /var/log/nginx

# Start supervisord
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf 