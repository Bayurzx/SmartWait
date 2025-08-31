# Healthcare Queue Management System - Kiro Directory Structure Creation Script (PowerShell)
# This script creates the complete directory structure with empty files

Write-Host "Creating Healthcare Queue Management System Kiro structure..." -ForegroundColor Green

# Create main .kiro directory
New-Item -ItemType Directory -Path ".kiro" -Force | Out-Null

# Create steering directory and files
Write-Host "Creating steering files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path ".kiro\steering" -Force | Out-Null

# Core steering files
$steeringFiles = @(
    "product.md",
    "tech.md", 
    "structure.md",
    "api-standards.md",
    "security-policies.md",
    "testing-standards.md",
    "healthcare-compliance.md",
    "integration-patterns.md",
    "mobile-standards.md",
    "steps.md"
)

foreach ($file in $steeringFiles) {
    New-Item -ItemType File -Path ".kiro\steering\$file" -Force | Out-Null
}

# Create specs directory
Write-Host "Creating specification directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path ".kiro\specs" -Force | Out-Null

# Define all features
$features = @(
    "check_in_methods",
    "virtual_queue_management", 
    "communication_notifications",
    "remote_waiting",
    "staff_dashboard",
    "digital_signage",
    "analytics_reporting",
    "integration_capabilities",
    "location_tracking"
)

# Create feature directories and files
foreach ($feature in $features) {
    Write-Host "Creating $feature specs..." -ForegroundColor Cyan
    $featurePath = ".kiro\specs\$feature"
    New-Item -ItemType Directory -Path $featurePath -Force | Out-Null
    
    # Create the three standard files for each feature
    New-Item -ItemType File -Path "$featurePath\requirements.md" -Force | Out-Null
    New-Item -ItemType File -Path "$featurePath\design.md" -Force | Out-Null
    New-Item -ItemType File -Path "$featurePath\tasks.md" -Force | Out-Null
}

# Create additional project structure directories
Write-Host "Creating additional project directories..." -ForegroundColor Yellow

# App directories
$appDirectories = @(
    "apps\mobile",
    "apps\web\patient-portal",
    "apps\web\staff-dashboard", 
    "apps\api\gateway",
    "apps\api\queue-service",
    "apps\api\notification-service",
    "apps\api\location-service",
    "apps\api\analytics-service",
    "apps\api\integration-service"
)

foreach ($dir in $appDirectories) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

# Package directories
$packageDirectories = @(
    "packages\shared",
    "packages\ui", 
    "packages\api-client",
    "packages\config"
)

foreach ($dir in $packageDirectories) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

# Infrastructure directories
$infraDirectories = @(
    "infrastructure\docker",
    "infrastructure\kubernetes",
    "infrastructure\terraform", 
    "infrastructure\scripts"
)

foreach ($dir in $infraDirectories) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

# Other directories
New-Item -ItemType Directory -Path "docs" -Force | Out-Null
New-Item -ItemType Directory -Path "tools" -Force | Out-Null

# Add placeholder README files
$readmeFiles = @(
    "apps\mobile\README.md",
    "apps\web\patient-portal\README.md",
    "apps\web\staff-dashboard\README.md",
    "apps\api\README.md",
    "packages\README.md", 
    "infrastructure\README.md",
    "docs\README.md",
    "tools\README.md"
)

foreach ($readme in $readmeFiles) {
    New-Item -ItemType File -Path $readme -Force | Out-Null
}

# Create root project files
$rootFiles = @(
    "README.md",
    "package.json",
    ".gitignore",
    ".env.example", 
    "docker-compose.yml"
)

foreach ($file in $rootFiles) {
    New-Item -ItemType File -Path $file -Force | Out-Null
}

Write-Host ""
Write-Host "✅ Directory structure created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Created directories:" -ForegroundColor White
Write-Host "   .kiro\steering\          - 10 steering files" -ForegroundColor Gray
Write-Host "   .kiro\specs\             - 9 feature specifications (27 files total)" -ForegroundColor Gray  
Write-Host "   apps\                    - Application directories" -ForegroundColor Gray
Write-Host "   packages\                - Shared package directories" -ForegroundColor Gray
Write-Host "   infrastructure\          - Infrastructure configurations" -ForegroundColor Gray
Write-Host "   docs\                    - Documentation" -ForegroundColor Gray
Write-Host "   tools\                   - Development tools" -ForegroundColor Gray
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor White
Write-Host "   1. Copy and paste the content from our conversation into the respective files" -ForegroundColor Gray
Write-Host "   2. Review and customize steering files for your specific needs" -ForegroundColor Gray
Write-Host "   3. Start with Phase 1 implementation (check-in methods)" -ForegroundColor Gray
Write-Host ""
Write-Host "🎯 Feature specifications ready for content:" -ForegroundColor White
Write-Host "   ✅ check_in_methods\ (requirements, design, tasks)" -ForegroundColor Green
Write-Host "   ✅ virtual_queue_management\ (requirements, design, tasks)" -ForegroundColor Green
Write-Host "   ✅ communication_notifications\ (requirements, design, partial tasks)" -ForegroundColor Green
Write-Host "   📝 remote_waiting\ (empty - ready for content)" -ForegroundColor Yellow
Write-Host "   📝 staff_dashboard\ (empty - ready for content)" -ForegroundColor Yellow
Write-Host "   📝 digital_signage\ (empty - ready for content)" -ForegroundColor Yellow
Write-Host "   📝 analytics_reporting\ (empty - ready for content)" -ForegroundColor Yellow
Write-Host "   📝 integration_capabilities\ (empty - ready for content)" -ForegroundColor Yellow
Write-Host "   📝 location_tracking\ (empty - ready for content)" -ForegroundColor Yellow