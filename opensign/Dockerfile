FROM node:18-alpine

# Install git, curl, and other dependencies
RUN apk add --no-cache git python3 make g++ curl

WORKDIR /app

# Clone OpenSign repository
RUN git clone https://github.com/OpenSignLabs/OpenSign.git .

# Change to the apps/OpenSign directory for the React app
WORKDIR /app/apps/OpenSign

# Install dependencies including AWS SDK
RUN npm install
RUN npm install aws-sdk @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Set environment for production
ENV NODE_ENV=development

# Create necessary directories
RUN mkdir -p /app/data

# Create a startup script that handles base path and S3 configuration
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'cd /app/apps/OpenSign' >> /app/start.sh && \
    echo 'if [ ! -z "$BASE_PATH" ]; then' >> /app/start.sh && \
    echo '  export PUBLIC_URL="$PUBLIC_URL"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'if [ ! -z "$AWS_S3_BUCKET" ]; then' >> /app/start.sh && \
    echo '  echo "Configuring S3 storage with bucket: $AWS_S3_BUCKET"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'npm run start-dev -- --host 0.0.0.0 --port 3000' >> /app/start.sh && \
    chmod +x /app/start.sh

EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["/app/start.sh"] 