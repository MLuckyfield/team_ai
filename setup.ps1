# Setup script for Multi-App Deployment
# Prepares the environment and guides through initial configuration

# Function to write colored output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Green "🏗️ Multi-App Deployment Setup"
Write-Output "================================================"

# Check if .env already exists
if (Test-Path ".env") {
    Write-ColorOutput Yellow "⚠️  .env file already exists"
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-ColorOutput Green "✅ Using existing .env file"
        Write-Output ""
    } else {
        Remove-Item ".env" -Force
    }
}

# Copy environment template if .env doesn't exist
if (-not (Test-Path ".env")) {
    if (Test-Path "env.example") {
        Copy-Item "env.example" ".env"
        Write-ColorOutput Green "✅ Created .env file from template"
    } else {
        Write-ColorOutput Red "❌ env.example file not found!"
        exit 1
    }
}

# Guide user through configuration
Write-ColorOutput Yellow "📝 Let's configure your deployment..."
Write-Output ""

# Domain configuration
Write-ColorOutput Yellow "🌐 Domain Configuration"
$currentDomain = (Select-String -Path ".env" -Pattern "DOMAIN=" | ForEach-Object { $_.Line -replace "DOMAIN=", "" })
Write-Output "Current domain: $currentDomain"
$newDomain = Read-Host "Enter your domain name (press Enter to keep current)"
if (-not [string]::IsNullOrWhiteSpace($newDomain)) {
    (Get-Content ".env") -replace "DOMAIN=.*", "DOMAIN=$newDomain" | Set-Content ".env"
    Write-ColorOutput Green "✅ Domain updated to: $newDomain"
}

# Email configuration
Write-ColorOutput Yellow "📧 SSL Email Configuration"
$currentEmail = (Select-String -Path ".env" -Pattern "SSL_EMAIL=" | ForEach-Object { $_.Line -replace "SSL_EMAIL=", "" })
Write-Output "Current email: $currentEmail"
$newEmail = Read-Host "Enter your email for SSL certificates (press Enter to keep current)"
if (-not [string]::IsNullOrWhiteSpace($newEmail)) {
    (Get-Content ".env") -replace "SSL_EMAIL=.*", "SSL_EMAIL=$newEmail" | Set-Content ".env"
    Write-ColorOutput Green "✅ Email updated to: $newEmail"
}

# Database password
Write-ColorOutput Yellow "🔒 Database Security"
$generatePassword = Read-Host "Generate a secure database password? (Y/n)"
if ($generatePassword -ne "n" -and $generatePassword -ne "N") {
    # Generate random password
    $password = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | ForEach-Object {[char]$_})
    (Get-Content ".env") -replace "DB_PASSWORD=.*", "DB_PASSWORD=$password" | Set-Content ".env"
    Write-ColorOutput Green "✅ Generated secure database password"
}

# AWS S3 Configuration
Write-ColorOutput Yellow "☁️ AWS S3 Configuration (for OpenSign file storage)"
Write-Output "OpenSign will use AWS S3 to store documents and files."
$configureS3 = Read-Host "Do you want to configure AWS S3 now? (Y/n)"
if ($configureS3 -ne "n" -and $configureS3 -ne "N") {
    $awsAccessKey = Read-Host "Enter AWS Access Key ID"
    if (-not [string]::IsNullOrWhiteSpace($awsAccessKey)) {
        (Get-Content ".env") -replace "AWS_ACCESS_KEY_ID=.*", "AWS_ACCESS_KEY_ID=$awsAccessKey" | Set-Content ".env"
        Write-ColorOutput Green "✅ AWS Access Key configured"
    }
    
    $awsSecretKey = Read-Host "Enter AWS Secret Access Key" -AsSecureString
    if ($awsSecretKey.Length -gt 0) {
        $awsSecretKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($awsSecretKey))
        (Get-Content ".env") -replace "AWS_SECRET_ACCESS_KEY=.*", "AWS_SECRET_ACCESS_KEY=$awsSecretKeyPlain" | Set-Content ".env"
        Write-ColorOutput Green "✅ AWS Secret Key configured"
    }
    
    $awsRegion = Read-Host "Enter AWS Region (default: us-east-1)"
    if (-not [string]::IsNullOrWhiteSpace($awsRegion)) {
        (Get-Content ".env") -replace "AWS_REGION=.*", "AWS_REGION=$awsRegion" | Set-Content ".env"
    }
    
    $s3Bucket = Read-Host "Enter S3 Bucket name for OpenSign files"
    if (-not [string]::IsNullOrWhiteSpace($s3Bucket)) {
        (Get-Content ".env") -replace "AWS_S3_BUCKET=.*", "AWS_S3_BUCKET=$s3Bucket" | Set-Content ".env"
        Write-ColorOutput Green "✅ S3 Bucket configured"
    }
}

# API Keys
Write-ColorOutput Yellow "🔑 API Keys (Optional)"
Write-Output "Crawl4AI can use OpenAI and Anthropic APIs for enhanced functionality."
$configureAPIs = Read-Host "Do you want to configure API keys now? (y/N)"
if ($configureAPIs -eq "y" -or $configureAPIs -eq "Y") {
    $openaiKey = Read-Host "Enter OpenAI API key (press Enter to skip)"
    if (-not [string]::IsNullOrWhiteSpace($openaiKey)) {
        (Get-Content ".env") -replace "OPENAI_API_KEY=.*", "OPENAI_API_KEY=$openaiKey" | Set-Content ".env"
        Write-ColorOutput Green "✅ OpenAI API key configured"
    }
    
    $anthropicKey = Read-Host "Enter Anthropic API key (press Enter to skip)"
    if (-not [string]::IsNullOrWhiteSpace($anthropicKey)) {
        (Get-Content ".env") -replace "ANTHROPIC_API_KEY=.*", "ANTHROPIC_API_KEY=$anthropicKey" | Set-Content ".env"
        Write-ColorOutput Green "✅ Anthropic API key configured"
    }
}

Write-Output ""
Write-ColorOutput Green "🎉 Setup completed!"
Write-Output "================================================"

# Display next steps
Write-ColorOutput Yellow "📋 Next Steps:"
Write-Output ""
Write-Output "1. ☁️ Ensure your AWS S3 bucket exists and has proper permissions"
Write-Output ""
Write-Output "2. 🌐 Configure DNS Records:"
Write-Output "   - Type: A, Name: @, Value: YOUR_SERVER_IP"
Write-Output "   - Type: A, Name: *, Value: YOUR_SERVER_IP"
Write-Output ""
Write-Output "3. 🐳 Ensure Docker is installed and running:"
Write-Output "   - Download from: https://docs.docker.com/desktop/install/windows-install/"
Write-Output ""
Write-Output "4. 🚀 Deploy the applications:"
Write-Output "   .\scripts\deploy.ps1"
Write-Output ""
Write-Output "5. 📊 Monitor the deployment:"
Write-Output "   .\scripts\monitor.ps1"
Write-Output ""

# Show current configuration
Write-ColorOutput Yellow "📄 Current Configuration:"
$envContent = Get-Content ".env" | Where-Object { $_ -notmatch "^#" -and $_ -match "=" }
foreach ($line in $envContent) {
    if ($line -match "PASSWORD|SECRET|KEY") {
        $key = ($line -split "=")[0]
        Write-Output "$key=***HIDDEN***"
    } else {
        Write-Output $line
    }
}

Write-Output ""
Write-ColorOutput Green "✨ Your multi-app deployment is ready to launch!" 