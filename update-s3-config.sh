#!/bin/bash

# OpenSign S3 Configuration Update Script
# Run this after setting up your AWS S3 bucket

echo "🚀 OpenSign S3 Configuration Helper"
echo "=================================="
echo ""

# Prompt for S3 configuration
read -p "Enter your S3 bucket name: " S3_BUCKET
read -p "Enter your AWS region (e.g., us-east-1): " AWS_REGION  
read -p "Enter your AWS Access Key ID: " AWS_ACCESS_KEY
read -s -p "Enter your AWS Secret Access Key: " AWS_SECRET_KEY
echo ""

# Generate the environment configuration
echo ""
echo "📝 Generated S3 Configuration:"
echo "=============================="
echo "DO_SPACE=$S3_BUCKET"
echo "DO_ENDPOINT=s3.$AWS_REGION.amazonaws.com"
echo "DO_BASEURL=https://$S3_BUCKET.s3.$AWS_REGION.amazonaws.com"
echo "DO_ACCESS_KEY_ID=$AWS_ACCESS_KEY"
echo "DO_SECRET_ACCESS_KEY=***hidden***"
echo "DO_REGION=$AWS_REGION"
echo "USE_LOCAL=false"
echo ""

# CORS configuration for S3
echo "🔧 Required S3 CORS Configuration:"
echo "================================="
echo "Add this CORS configuration to your S3 bucket:"
echo ""
cat << 'EOF'
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT", 
            "POST"
        ],
        "AllowedOrigins": [
            "https://unified-minimal-platform-5p64u.ondigitalocean.app",
            "https://localhost:3001"
        ],
        "ExposeHeaders": [
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2"
        ],
        "MaxAgeSeconds": 3000
    }
]
EOF

echo ""
echo "✅ Next Steps:"
echo "1. Configure CORS in your S3 bucket (see above)"
echo "2. Update the Dockerfile.full-opensign with your actual S3 values"
echo "3. Redeploy the application"
echo "" 