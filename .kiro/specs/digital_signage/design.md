# Digital Signage - Technical Design

## Architecture Overview

### Digital Signage System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                  Content Management System                  │
│                    (React Admin Panel)                      │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Content Editor │  Display Config │   Template Manager     │
│                 │                 │                         │
│ • Message Mgmt  │ • Location Setup│ • Layout Templates     │
│ • Scheduling    │ • Screen Config │ • Brand Guidelines     │
│ • Approval Flow │ • Zone Mapping  │ • Content Validation   │
└─────────────────┴─────────────────┴─────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Display Controller Service                 │
│                   (Node.js + WebSocket)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────────┐
│    Event Stream     │     Display Clients                   │
│   (Apache Kafka)    │                                       │
│                     │ ┌─────────────┬─────────────────────┐ │
│ • Queue Updates     │ │   Web-based │    Native Apps      │ │
│ • Patient Calls     │ │   Displays  │   (Android TV)      │ │
│ • System Alerts     │ │             │                     │ │
│ • Content Changes   │ └─────────────┴─────────────────────┘ │
└─────────────────────┴───────────────────────────────────────┘
```

## Data Models

### Display Configuration
```typescript
interface DisplayConfig {
  id: string;
  facilityId: string;
  location: {
    name: string;
    type: 'main_lobby' | 'department_waiting' | 'hallway' | 'entrance' | 'exam_area';
    floor: string;
    room?: string;
    coordinates?: { x: number; y: number; floor: string };
  };
  hardware: {
    screenSize: number; // inches
    resolution: { width: number; height: number };
    orientation: 'landscape' | 'portrait';
    brightness: number; // 0-100
    volume: number; // 0-100 (if audio capable)
    operatingSystem: 'android' | 'windows' | 'linux' | 'web';
  };
  content: {
    defaultTemplate: string;
    allowedContentTypes: string[];
    refreshInterval: number; // seconds
    cacheSize: number; // MB
    emergencyOverride: boolean;
  };
  display: {
    showQueueInfo: boolean;
    queueFilter: string[]; // Which queues to show
    showGeneralInfo: boolean;
    showEmergencyAlerts: boolean;
    autoLanguageCycling: boolean;
    languages: string[];
  };
  network: {
    ipAddress: string;
    macAddress: string;
    lastSeen: Date;
    connectionType: 'ethernet' | 'wifi';
    signalStrength?: number;
  };
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastHealthCheck: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Content Template
```typescript
interface ContentTemplate {
  id: string;
  name: string;
  type: 'queue_status' | 'now_serving' | 'general_info' | 'emergency' | 'promotional';
  layout: {
    regions: Array<{
      id: string;
      type: 'queue_list' | 'now_serving' | 'text' | 'image' | 'video' | 'weather' | 'time';
      position: { x: number; y: number; width: number; height: number };
      styling: {
        backgroundColor?: string;
        textColor?: string;
        fontSize?: number;
        fontWeight?: string;
        border?: string;
        padding?: number;
      };
      content?: any; // Type-specific content configuration
    }>;
  };
  responsive: {
    breakpoints: Array<{
      minWidth: number;
      layout: any; // Alternative layout for different screen sizes
    }>;
  };
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    screenReaderText?: string;
  };
  languages: string[];
  isActive: boolean;
  facilityId: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Display Content
```typescript
interface DisplayContent {
  id: string;
  displayId: string;
  templateId: string;
  content: {
    queueData?: {
      queues: Array<{
        id: string;
        name: string;
        currentSize: number;
        averageWait: number;
        status: string;
        nextPatientPosition?: number;
      }>;
    };
    nowServing?: {
      calls: Array<{
        position: string; // "A15" or "15" 
        roomNumber?: string;
        department?: string;
        timestamp: Date;
      }>;
    };
    generalInfo?: {
      title: string;
      message: string;
      imageUrl?: string;
      links?: Array<{ text: string; url: string }>;
    };
    emergencyInfo?: {
      alertLevel: 'info' | 'warning' | 'critical';
      title: string;
      message: string;
      instructions?: string[];
      contactInfo?: string;
    };
  };
  scheduling: {
    startTime?: Date;
    endTime?: Date;
    isRecurring?: boolean;
    recurrencePattern?: string;
  };
  priority: number; // Higher number = higher priority
  language: string;
  lastUpdated: Date;
  isActive: boolean;
}
```

## Service Implementation

### Display Controller Service
```typescript
export class DisplayControllerService {
  constructor(
    private displayRepository: DisplayRepository,
    private contentService: ContentService,
    private queueService: QueueService,
    private webSocketService: WebSocketService,
    private eventConsumer: EventConsumer
  ) {
    this.setupEventConsumers();
  }

  async updateDisplayContent(displayId: string): Promise<void> {
    const display = await this.displayRepository.findById(displayId);
    if (!display || display.status !== 'online') {
      return;
    }

    // Get current content for this display
    const content = await this.generateDisplayContent(display);
    
    // Send update to display client
    await this.webSocketService.sendToDisplay(displayId, {
      type: 'content_update',
      content,
      timestamp: new Date()
    });

    // Update last content change timestamp
    await this.displayRepository.updateLastContent(displayId, new Date());
  }

  private async generateDisplayContent(display: DisplayConfig): Promise<DisplayContent> {
    const template = await this.contentService.getTemplate(display.content.defaultTemplate);
    const content: any = {};

    // Generate queue content if enabled
    if (display.display.showQueueInfo) {
      content.queueData = await this.generateQueueContent(display);
    }

    // Generate now serving content
    content.nowServing = await this.generateNowServingContent(display);

    // Generate general information content
    if (display.display.showGeneralInfo) {
      content.generalInfo = await this.generateGeneralContent(display);
    }

    // Check for emergency content
    const emergencyContent = await this.getEmergencyContent(display.facilityId);
    if (emergencyContent) {
      content.emergencyInfo = emergencyContent;
    }

    return {
      id: `content-${Date.now()}`,
      displayId: display.id,
      templateId: template.id,
      content,
      scheduling: { isRecurring: false },
      priority: emergencyContent ? 100 : 50,
      language: display.display.languages[0] || 'en',
      lastUpdated: new Date(),
      isActive: true
    };
  }

  private async generateQueueContent(display: DisplayConfig): Promise<any> {
    const relevantQueues = await this.queueService.getQueuesForDisplay(
      display.facilityId,
      display.display.queueFilter
    );

    return {
      queues: relevantQueues.map(queue => ({
        id: queue.id,
        name: queue.displayName,
        currentSize: queue.currentSize,
        averageWait: Math.round(queue.averageWaitTime),
        status: queue.status,
        nextPatientPosition: queue.nextPatientPosition
      }))
    };
  }

  private async generateNowServingContent(display: DisplayConfig): Promise<any> {
    const recentCalls = await this.queueService.getRecentPatientCalls(
      display.facilityId,
      5 // Last 5 calls
    );

    return {
      calls: recentCalls.map(call => ({
        position: this.formatPositionForDisplay(call.position, call.queueType),
        roomNumber: call.roomAssignment,
        department: call.department,
        timestamp: call.calledAt
      }))
    };
  }

  private setupEventConsumers(): void {
    this.eventConsumer.subscribe('queue-updates', async (event) => {
      const affectedDisplays = await this.getDisplaysForQueue(event.queueId);
      
      for (const display of affectedDisplays) {
        await this.updateDisplayContent(display.id);
      }
    });

    this.eventConsumer.subscribe('patient-called', async (event) => {
      const facilityDisplays = await this.getDisplaysForFacility(event.facilityId);
      
      for (const display of facilityDisplays) {
        await this.updateNowServingDisplay(display.id, event);
      }
    });

    this.eventConsumer.subscribe('emergency-alert', async (event) => {
      const facilityDisplays = await this.getDisplaysForFacility(event.facilityId);
      
      for (const display of facilityDisplays) {
        await this.showEmergencyContent(display.id, event);
      }
    });
  }
}
```

### Content Management Service
```typescript
export class ContentManagementService {
  constructor(
    private templateRepository: TemplateRepository,
    private contentRepository: ContentRepository,
    private approvalService: ApprovalService
  ) {}

  async createContent(
    facilityId: string,
    contentData: CreateContentRequest,
    createdBy: string
  ): Promise<DisplayContent> {
    // Validate content
    await this.validateContent(contentData);

    // Create content object
    const content: DisplayContent = {
      id: this.generateId(),
      displayId: contentData.displayId,
      templateId: contentData.templateId,
      content: contentData.content,
      scheduling: contentData.scheduling,
      priority: contentData.priority || 50,
      language: contentData.language || 'en',
      lastUpdated: new Date(),
      isActive: false // Requires approval
    };

    // Save to repository
    await this.contentRepository.save(content);

    // Submit for approval if required
    if (this.requiresApproval(content)) {
      await this.approvalService.submitForApproval(content.id, createdBy);
    } else {
      // Auto-approve for certain content types
      await this.approveContent(content.id, 'system');
    }

    return content;
  }

  async approveContent(contentId: string, approvedBy: string): Promise<void> {
    const content = await this.contentRepository.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    // Update content status
    content.isActive = true;
    await this.contentRepository.save(content);

    // Schedule content activation
    if (content.scheduling.startTime) {
      await this.scheduleContentActivation(content);
    } else {
      // Activate immediately
      await this.activateContent(content);
    }

    // Log approval
    await this.auditService.logContentApproval({
      contentId,
      approvedBy,
      approvedAt: new Date()
    });
  }

  async scheduleContentActivation(content: DisplayContent): Promise<void> {
    if (!content.scheduling.startTime) {
      return;
    }

    const delay = content.scheduling.startTime.getTime() - Date.now();
    
    if (delay > 0) {
      // Schedule for future activation
      await this.schedulerService.schedule('activate-content', {
        contentId: content.id
      }, delay);
    } else {
      // Activate immediately if scheduled time has passed
      await this.activateContent(content);
    }

    // Schedule deactivation if end time is specified
    if (content.scheduling.endTime) {
      const deactivationDelay = content.scheduling.endTime.getTime() - Date.now();
      if (deactivationDelay > 0) {
        await this.schedulerService.schedule('deactivate-content', {
          contentId: content.id
        }, deactivationDelay);
      }
    }
  }

  private async activateContent(content: DisplayContent): Promise<void> {
    // Send content to appropriate displays
    const display = await this.displayRepository.findById(content.displayId);
    if (display) {
      await this.displayControllerService.updateDisplayContent(display.id);
    }

    // Publish content activation event
    await this.eventPublisher.publish('display.content.activated', {
      contentId: content.id,
      displayId: content.displayId,
      activatedAt: new Date()
    });
  }
}
```

### Display Client Implementation
```typescript
// Web-based display client that runs on display hardware
export class DisplayClient {
  private websocket: WebSocket | null = null;
  private displayId: string;
  private currentContent: DisplayContent | null = null;
  private isOnline = false;

  constructor(displayId: string) {
    this.displayId = displayId;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Get display configuration
    const config = await this.fetchDisplayConfig();
    
    // Setup display hardware
    await this.setupDisplay(config);
    
    // Connect to WebSocket server
    await this.connectWebSocket();
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Load initial content
    await this.loadInitialContent();
  }

  private async connectWebSocket(): Promise<void> {
    const wsUrl = `${process.env.WEBSOCKET_URL}/displays`;
    this.websocket = new WebSocket(wsUrl);

    this.websocket.onopen = () => {
      console.log('Connected to display controller');
      this.isOnline = true;
      
      // Join display-specific room
      this.send({
        type: 'join_display_room',
        displayId: this.displayId
      });
    };

    this.websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.websocket.onclose = () => {
      console.log('Disconnected from display controller');
      this.isOnline = false;
      
      // Attempt reconnection after 5 seconds
      setTimeout(() => this.connectWebSocket(), 5000);
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'content_update':
        this.updateContent(message.content);
        break;
      case 'emergency_override':
        this.showEmergencyContent(message.content);
        break;
      case 'config_update':
        this.updateDisplayConfig(message.config);
        break;
      case 'health_check':
        this.respondToHealthCheck();
        break;
    }
  }

  private async updateContent(content: DisplayContent): Promise<void> {
    try {
      this.currentContent = content;
      await this.renderContent(content);
      
      // Send acknowledgment
      this.send({
        type: 'content_updated',
        displayId: this.displayId,
        contentId: content.id,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Failed to update content:', error);
      
      // Send error report
      this.send({
        type: 'content_error',
        displayId: this.displayId,
        error: error.message,
        timestamp: new Date()
      });
    }
  }

  private async renderContent(content: DisplayContent): Promise<void> {
    const container = document.getElementById('display-container');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    // Render based on template
    const template = await this.getTemplate(content.templateId);
    const renderer = new ContentRenderer(template, content);
    
    const renderedElement = await renderer.render();
    container.appendChild(renderedElement);

    // Start auto-refresh if configured
    if (template.autoRefresh) {
      this.scheduleContentRefresh(template.refreshInterval);
    }
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      const healthData = await this.collectHealthData();
      
      this.send({
        type: 'health_report',
        displayId: this.displayId,
        health: healthData,
        timestamp: new Date()
      });
    }, 30000); // Every 30 seconds
  }

  private async collectHealthData(): Promise<DisplayHealth> {
    return {
      isOnline: this.isOnline,
      lastContentUpdate: this.currentContent?.lastUpdated || null,
      screenResolution: {
        width: window.screen.width,
        height: window.screen.height
      },
      memoryUsage: (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize
      } : null,
      connectionQuality: this.assessConnectionQuality(),
      displayErrors: this.getRecentErrors(),
      uptime: Date.now() - this.startTime
    };
  }

  private send(message: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }
}
```

### Content Renderer
```typescript
export class ContentRenderer {
  constructor(
    private template: ContentTemplate,
    private content: DisplayContent
  ) {}

  async render(): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.className = 'display-content-container';
    container.style.cssText = `
      width: 100vw;
      height: 100vh;
      position: relative;
      overflow: hidden;
      background: ${this.template.layout.backgroundColor || '#ffffff'};
    `;

    // Render each region
    for (const region of this.template.layout.regions) {
      const regionElement = await this.renderRegion(region);
      container.appendChild(regionElement);
    }

    return container;
  }

  private async renderRegion(region: any): Promise<HTMLElement> {
    const element = document.createElement('div');
    element.className = `display-region region-${region.type}`;
    element.style.cssText = this.generateRegionCSS(region);

    switch (region.type) {
      case 'queue_list':
        await this.renderQueueList(element, region);
        break;
      case 'now_serving':
        await this.renderNowServing(element, region);
        break;
      case 'text':
        await this.renderTextContent(element, region);
        break;
      case 'image':
        await this.renderImageContent(element, region);
        break;
      case 'time':
        await this.renderTimeDisplay(element, region);
        break;
    }

    return element;
  }

  private async renderQueueList(element: HTMLElement, region: any): Promise<void> {
    const queueData = this.content.content.queueData;
    if (!queueData) return;

    const queueListHTML = `
      <div class="queue-list">
        <h2 class="queue-header">Current Wait Times</h2>
        <div class="queue-items">
          ${queueData.queues.map(queue => `
            <div class="queue-item">
              <div class="queue-name">${queue.name}</div>
              <div class="queue-stats">
                <span class="patients-waiting">${queue.currentSize} patients</span>
                <span class="average-wait">${queue.averageWait} min wait</span>
              </div>
              <div class="queue-status status-${queue.status}">${queue.status}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    element.innerHTML = queueListHTML;
    
    // Apply animations for queue updates
    this.animateQueueChanges(element);
  }

  private async renderNowServing(element: HTMLElement, region: any): Promise<void> {
    const nowServing = this.content.content.nowServing;
    if (!nowServing || nowServing.calls.length === 0) {
      element.innerHTML = '<div class="no-calls">No current calls</div>';
      return;
    }

    const nowServingHTML = `
      <div class="now-serving">
        <h2 class="now-serving-header">Now Serving</h2>
        <div class="current-calls">
          ${nowServing.calls.map(call => `
            <div class="call-item">
              <div class="position-number">${call.position}</div>
              <div class="room-info">
                ${call.roomNumber ? `Room ${call.roomNumber}` : ''}
                ${call.department ? `<br>${call.department}` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    element.innerHTML = nowServingHTML;
    
    // Add blinking animation for urgent calls
    this.animateCurrentCalls(element);
  }

  private generateRegionCSS(region: any): string {
    const { position, styling } = region;
    
    return `
      position: absolute;
      left: ${position.x}%;
      top: ${position.y}%;
      width: ${position.width}%;
      height: ${position.height}%;
      background-color: ${styling.backgroundColor || 'transparent'};
      color: ${styling.textColor || '#000000'};
      font-size: ${styling.fontSize || 16}px;
      font-weight: ${styling.fontWeight || 'normal'};
      border: ${styling.border || 'none'};
      padding: ${styling.padding || 0}px;
      box-sizing: border-box;
    `;
  }

  private animateQueueChanges(element: HTMLElement): void {
    // Add CSS animation for smooth queue updates
    element.querySelectorAll('.queue-item').forEach((item, index) => {
      (item as HTMLElement).style.animation = `fadeInSlide 0.5s ease-in-out ${index * 0.1}s both`;
    });
  }

  private animateCurrentCalls(element: HTMLElement): void {
    // Add attention-grabbing animation for current calls
    element.querySelectorAll('.call-item').forEach(item => {
      (item as HTMLElement).style.animation = 'pulse 2s infinite';
    });
  }
}
```

## Display Client Architecture

### Web-Based Display Client
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Healthcare Display</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            overflow: hidden;
            background: #f5f5f5;
        }
        
        .display-container {
            width: 100vw;
            height: 100vh;
            position: relative;
        }
        
        .queue-list {
            padding: 20px;
        }
        
        .queue-header {
            font-size: 2.5em;
            color: #2c3e50;
            text-align: center;
            margin-bottom: 30px;
        }
        
        .queue-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            margin: 10px 0;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .queue-name {
            font-size: 1.8em;
            font-weight: bold;
            color: #34495e;
        }
        
        .queue-stats {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .patients-waiting {
            font-size: 1.5em;
            color: #3498db;
        }
        
        .average-wait {
            font-size: 1.2em;
            color: #7f8c8d;
        }
        
        .now-serving {
            background: #e74c3c;
            color: white;
            padding: 20px;
            text-align: center;
        }
        
        .now-serving-header {
            font-size: 3em;
            margin-bottom: 20px;
        }
        
        .call-item {
            margin: 15px 0;
            padding: 20px;
            background: rgba(255,255,255,0.2);
            border-radius: 8px;
        }
        
        .position-number {
            font-size: 4em;
            font-weight: bold;
        }
        
        @keyframes fadeInSlide {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .status-active { color: #27ae60; }
        .status-paused { color: #f39c12; }
        .status-closed { color: #e74c3c; }
        
        /* High contrast mode */
        @media (prefers-contrast: high) {
            .queue-item {
                border: 2px solid #000;
                background: #fff;
            }
            
            .queue-name {
                color: #000;
            }
        }
        
        /* Large text mode */
        @media (prefers-reduced-motion: reduce) {
            .queue-item {
                animation: none !important;
            }
        }
    </style>
</head>
<body>
    <div id="display-container" class="display-container">
        <!-- Content will be dynamically loaded here -->
    </div>
    
    <script>
        // Display client initialization
        const displayClient = new DisplayClient(DISPLAY_ID);
    </script>
</body>
</html>
```

### Multi-Language Display Support
```typescript
export class MultiLanguageDisplayService {
  constructor(
    private i18nService: I18nService,
    private contentService: ContentService
  ) {}

  async renderMultiLanguageContent(
    content: DisplayContent,
    languages: string[]
  ): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.className = 'multi-language-container';

    if (languages.length === 1) {
      // Single language display
      return await this.renderSingleLanguage(content, languages[0]);
    }

    // Multiple language cycling
    const languageContainers: HTMLElement[] = [];
    
    for (const language of languages) {
      const langContent = await this.translateContent(content, language);
      const langElement = await this.renderSingleLanguage(langContent, language);
      langElement.style.display = 'none';
      languageContainers.push(langElement);
      container.appendChild(langElement);
    }

    // Start language cycling
    this.startLanguageCycling(languageContainers);

    return container;
  }

  private startLanguageCycling(containers: HTMLElement[]): void {
    let currentIndex = 0;
    
    // Show first language
    containers[0].style.display = 'block';

    setInterval(() => {
      // Hide current language
      containers[currentIndex].style.display = 'none';
      
      // Move to next language
      currentIndex = (currentIndex + 1) % containers.length;
      
      // Show next language with fade transition
      containers[currentIndex].style.display = 'block';
      containers[currentIndex].style.animation = 'fadeIn 0.5s ease-in-out';
      
    }, 10000); // Change every 10 seconds
  }

  private async translateContent(
    content: DisplayContent,
    language: string
  ): Promise<DisplayContent> {
    const translatedContent = { ...content };

    // Translate queue names and labels
    if (content.content.queueData) {
      translatedContent.content.queueData.queues = content.content.queueData.queues.map(queue => ({
        ...queue,
        name: this.i18nService.translate(`queue.${queue.id}.name`, language) || queue.name
      }));
    }

    // Translate general information
    if (content.content.generalInfo) {
      translatedContent.content.generalInfo = {
        ...content.content.generalInfo,
        title: this.i18nService.translate(content.content.generalInfo.title, language),
        message: this.i18nService.translate(content.content.generalInfo.message, language)
      };
    }

    return translatedContent;
  }
}
```

## Performance Optimization

### Caching and CDN Strategy
```typescript
export class DisplayCacheService {
  constructor(private redis: Redis, private cdnService: CDNService) {}

  async cacheDisplayContent(displayId: string, content: DisplayContent): Promise<void> {
    const key = `display_content:${displayId}`;
    await this.redis.setex(key, 300, JSON.stringify(content)); // 5 minute TTL
  }

  async preloadStaticAssets(template: ContentTemplate): Promise<void> {
    const assets = this.extractStaticAssets(template);
    
    for (const asset of assets) {
      await this.cdnService.prefetch(asset.url);
    }
  }

  async optimizeForDisplay(content: DisplayContent, displayConfig: DisplayConfig): Promise<DisplayContent> {
    // Optimize images for display resolution
    if (content.content.generalInfo?.imageUrl) {
      const optimizedImageUrl = await this.cdnService.optimizeImage(
        content.content.generalInfo.imageUrl,
        {
          width: displayConfig.hardware.resolution.width,
          height: displayConfig.hardware.resolution.height,
          quality: 85,
          format: 'webp'
        }
      );
      
      content.content.generalInfo.imageUrl = optimizedImageUrl;
    }

    // Optimize text for display size and viewing distance
    const optimalFontSize = this.calculateOptimalFontSize(
      displayConfig.hardware.screenSize,
      displayConfig.location.type
    );

    // Apply font size optimization to template regions
    // Implementation depends on specific template structure

    return content;
  }

  private calculateOptimalFontSize(screenSizeInches: number, locationType: string): number {
    const baseSize = 16; // Base font size in pixels
    const sizeMultipliers = {
      'main_lobby': 2.5,      // Large displays, far viewing
      'department_waiting': 2.0, // Medium distance viewing
      'hallway': 1.8,         // Walking viewing
      'entrance': 2.2,        // Quick viewing
      'exam_area': 1.5        // Close viewing
    };

    const multiplier = sizeMultipliers[locationType] || 2.0;
    const screenMultiplier = Math.sqrt(screenSizeInches / 32); // Normalize to 32" screen

    return Math.round(baseSize * multiplier * screenMultiplier);
  }
}
```

### Display Health Monitoring
```typescript
export class DisplayHealthMonitor {
  constructor(
    private displayRepository: DisplayRepository,
    private alertService: AlertService
  ) {}

  async monitorDisplayHealth(displayId: string): Promise<DisplayHealthStatus> {
    const display = await this.displayRepository.findById(displayId);
    const health = await this.collectHealthMetrics(display);

    // Analyze health metrics
    const status = this.analyzeHealthStatus(health);

    // Generate alerts if needed
    if (status.issues.length > 0) {
      await this.generateHealthAlerts(displayId, status.issues);
    }

    return status;
  }

  private async collectHealthMetrics(display: DisplayConfig): Promise<any> {
    return {
      connectivity: {
        isOnline: display.status === 'online',
        lastSeen: display.network.lastSeen,
        signalStrength: display.network.signalStrength,
        responseTime: await this.pingDisplay(display.id)
      },
      content: {
        lastContentUpdate: await this.getLastContentUpdate(display.id),
        contentErrors: await this.getContentErrors(display.id),
        cacheHitRate: await this.getCachePerformance(display.id)
      },
      hardware: {
        uptime: await this.getDisplayUptime(display.id),
        temperature: await this.getDisplayTemperature(display.id),
        memoryUsage: await this.getMemoryUsage(display.id),
        storageUsage: await this.getStorageUsage(display.id)
      }
    };
  }

  private analyzeHealthStatus(metrics: any): DisplayHealthStatus {
    const issues: HealthIssue[] = [];
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check connectivity issues
    if (!metrics.connectivity.isOnline) {
      issues.push({
        type: 'connectivity',
        severity: 'critical',
        message: 'Display is offline',
        recommendation: 'Check network connection and power supply'
      });
      overallStatus = 'critical';
    } else if (metrics.connectivity.responseTime > 5000) {
      issues.push({
        type: 'performance',
        severity: 'warning',
        message: 'Slow response time detected',
        recommendation: 'Check network bandwidth and display performance'
      });
      if (overallStatus !== 'critical') overallStatus = 'warning';
    }

    // Check content issues
    const timeSinceLastUpdate = Date.now() - metrics.content.lastContentUpdate;
    if (timeSinceLastUpdate > 300000) { // 5 minutes
      issues.push({
        type: 'content',
        severity: 'warning',
        message: 'Content not updated recently',
        recommendation: 'Verify content service and display connectivity'
      });
      if (overallStatus !== 'critical') overallStatus = 'warning';
    }

    // Check hardware issues
    if (metrics.hardware.memoryUsage > 90) {
      issues.push({
        type: 'hardware',
        severity: 'warning',
        message: 'High memory usage detected',
        recommendation: 'Restart display or optimize content'
      });
      if (overallStatus !== 'critical') overallStatus = 'warning';
    }

    return {
      displayId: metrics.displayId,
      status: overallStatus,
      issues,
      metrics,
      lastChecked: new Date()
    };
  }
}
```# Digital Signage - Technical Design

## Architecture Overview

### Digital Signage System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                  Content Management System                  │
│                    (React Admin Panel)                      │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Content Editor │  Display Config │   Template Manager     │
│                 │                 │                         │
│ • Message Mgmt  │ • Location Setup│ • Layout Templates     │
│ • Scheduling    │ • Screen Config │ • Brand Guidelines     │
│ • Approval Flow │ • Zone Mapping  │ • Content Validation   │
└─────────────────┴─────────────────┴─────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Display Controller Service                 │
│                   (Node.js + WebSocket)                     │
└─────────────────