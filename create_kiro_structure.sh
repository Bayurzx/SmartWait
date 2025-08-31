#!/bin/bash

# Healthcare Queue Management System - Kiro Directory Structure Creation Script
# This script creates the complete directory structure with empty files

echo "Creating Healthcare Queue Management System Kiro structure..."

# Create main .kiro directory
mkdir -p .kiro

# Create steering directory and files
echo "Creating steering files..."
mkdir -p .kiro/steering

# Core steering files
touch .kiro/steering/product.md
touch .kiro/steering/tech.md
touch .kiro/steering/structure.md
touch .kiro/steering/api-standards.md
touch .kiro/steering/security-policies.md
touch .kiro/steering/testing-standards.md
touch .kiro/steering/healthcare-compliance.md
touch .kiro/steering/integration-patterns.md
touch .kiro/steering/mobile-standards.md
touch .kiro/steering/steps.md

# Create specs directory
echo "Creating specification directories..."
mkdir -p .kiro/specs

# Feature 1: Check-In Methods
echo "Creating check-in methods specs..."
mkdir -p .kiro/specs/check_in_methods
touch .kiro/specs/check_in_methods/requirements.md
touch .kiro/specs/check_in_methods/design.md
touch .kiro/specs/check_in_methods/tasks.md

# Feature 2: Virtual Queue Management
echo "Creating virtual queue management specs..."
mkdir -p .kiro/specs/virtual_queue_management
touch .kiro/specs/virtual_queue_management/requirements.md
touch .kiro/specs/virtual_queue_management/design.md
touch .kiro/specs/virtual_queue_management/tasks.md

# Feature 3: Communication & Notifications
echo "Creating communication notifications specs..."
mkdir -p .kiro/specs/communication_notifications
touch .kiro/specs/communication_notifications/requirements.md
touch .kiro/specs/communication_notifications/design.md
touch .kiro/specs/communication_notifications/tasks.md

# Feature 4: Remote Waiting
echo "Creating remote waiting specs..."
mkdir -p .kiro/specs/remote_waiting
touch .kiro/specs/remote_waiting/requirements.md
touch .kiro/specs/remote_waiting/design.md
touch .kiro/specs/remote_waiting/tasks.md

# Feature 5: Staff Dashboard
echo "Creating staff dashboard specs..."
mkdir -p .kiro/specs/staff_dashboard
touch .kiro/specs/staff_dashboard/requirements.md
touch .kiro/specs/staff_dashboard/design.md
touch .kiro/specs/staff_dashboard/tasks.md

# Feature 6: Digital Signage
echo "Creating digital signage specs..."
mkdir -p .kiro/specs/digital_signage
touch .kiro/specs/digital_signage/requirements.md
touch .kiro/specs/digital_signage/design.md
touch .kiro/specs/digital_signage/tasks.md

# Feature 7: Analytics & Reporting
echo "Creating analytics reporting specs..."
mkdir -p .kiro/specs/analytics_reporting
touch .kiro/specs/analytics_reporting/requirements.md
touch .kiro/specs/analytics_reporting/design.md
touch .kiro/specs/analytics_reporting/tasks.md

# Feature 8: Integration Capabilities
echo "Creating integration capabilities specs..."
mkdir -p .kiro/specs/integration_capabilities
touch .kiro/specs/integration_capabilities/requirements.md
touch .kiro/specs/integration_capabilities/design.md
touch .kiro/specs/integration_capabilities/tasks.md

# Feature 9: Location Tracking
echo "Creating location tracking specs..."
mkdir -p .kiro/specs/location_tracking
touch .kiro/specs/location_tracking/requirements.md
touch .kiro/specs/location_tracking/design.md
touch .kiro/specs/location_tracking/tasks.md

# Create additional project structure directories (optional)
echo "Creating additional project directories..."
mkdir -p apps/mobile
mkdir -p apps/web/patient-portal
mkdir -p apps/web/staff-dashboard
mkdir -p apps/api/gateway
mkdir -p apps/api/queue-service
mkdir -p apps/api/notification-service
mkdir -p apps/api/location-service
mkdir -p apps/api/analytics-service
mkdir -p apps/api/integration-service

mkdir -p packages/shared
mkdir -p packages/ui
mkdir -p packages/api-client
mkdir -p packages/config

mkdir -p infrastructure/docker
mkdir -p infrastructure/kubernetes
mkdir -p infrastructure/terraform
mkdir -p infrastructure/scripts

mkdir -p docs
mkdir -p tools

# Add placeholder README files
touch apps/mobile/README.md
touch apps/web/patient-portal/README.md
touch apps/web/staff-dashboard/README.md
touch apps/api/README.md
touch packages/README.md
touch infrastructure/README.md
touch docs/README.md
touch tools/README.md

# Create root project files
touch README.md
touch package.json
touch .gitignore
touch .env.example
touch docker-compose.yml

echo ""
echo "✅ Directory structure created successfully!"
echo ""
echo "📁 Created directories:"
echo "   .kiro/steering/          - 10 steering files"
echo "   .kiro/specs/             - 9 feature specifications (27 files total)"
echo "   apps/                    - Application directories"
echo "   packages/                - Shared package directories"
echo "   infrastructure/          - Infrastructure configurations"
echo "   docs/                    - Documentation"
echo "   tools/                   - Development tools"
echo ""
echo "📋 Next steps:"
echo "   1. Copy and paste the content from our conversation into the respective files"
echo "   2. Review and customize steering files for your specific needs"
echo "   3. Start with Phase 1 implementation (check-in methods)"
echo ""
echo "🎯 Feature specifications ready for content:"
echo "   ✅ check_in_methods/ (requirements, design, tasks)"
echo "   ✅ virtual_queue_management/ (requirements, design, tasks)" 
echo "   ✅ communication_notifications/ (requirements, design, partial tasks)"
echo "   📝 remote_waiting/ (empty - ready for content)"
echo "   📝 staff_dashboard/ (empty - ready for content)"
echo "   📝 digital_signage/ (empty - ready for content)"
echo "   📝 analytics_reporting/ (empty - ready for content)"
echo "   📝 integration_capabilities/ (empty - ready for content)"
echo "   📝 location_tracking/ (empty - ready for content)"