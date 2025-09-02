# Analytics & Reporting - Technical Design

## Architecture Overview

### Analytics Platform Architecture
```
┌─────────────────────────────────────────────────────────────┐
│              Analytics Frontend Dashboard                   │
│                 (React + Chart.js/D3)                      │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Real-Time     │   Historical    │    Custom Reports      │
│   Dashboards    │   Reports       │                         │
│                 │                 │ • Report Builder       │
│ • Live Metrics  │ • Trend Analysis│ • Scheduled Reports    │
│ • Alerts        │ • Comparisons   │ • Data Export          │
│ • KPI Widgets   │ • Forecasting   │ • External Integration │
└─────────────────┴─────────────────┴─────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Analytics API Gateway                     │
│                    (GraphQL + REST)                         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────┬─────────────────┬─────────────────────────┤
│   Stream        │   Batch         │     ML Platform         │
│  Processing     │  Processing     │                         │
│                 │                 │ • Predictive Models    │
│ • Apache Flink  │ • Apache Spark  │ • Anomaly Detection    │
│ • Real-time     │ • ETL Jobs      │ • Forecast Engine      │
│   Aggregation   │ • Data Warehouse│ • Pattern Recognition  │
└─────────────────┴─────────────────┴─────────────────────────┘
                              │
┌─────────────────┬─────────────────┬─────────────────────────┤
│   Event Store   │  Data Warehouse │    External Data        │
│   (Kafka)       │  (PostgreSQL/   │                         │
│                 │   Snowflake)    │ • Weather APIs         │
│ • Queue Events  │                 │ • Traffic Data         │
│ • Patient Events│ • Aggregated    │ • Calendar Systems     │
│ • System Events │   Metrics       │ • Benchmark Data       │
│ • User Actions  │ • Historical    │                         │
│                 │   Trends        │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Data Models

### Analytics Event
```typescript
interface AnalyticsEvent {
  id: string;
  eventType: string;
  category: 'queue' | 'patient' | 'staff' | 'system' | 'facility';
  timestamp: Date;
  facilityId: string;
  userId?: string;
  patientId?: string;
  queueId?: string;
  data: Record<string, any>;
  metadata: {
    source: string;
    version: string;
    sessionId?: string;
    deviceInfo?: {
      platform: string;
      userAgent: string;
      ipAddress: string;
    };
  };
  processed: boolean;
  processingErrors?: string[];
}
```

### Metrics Definition
```typescript
interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  category: 'operational' | 'financial' | 'quality' | 'satisfaction';
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  unit: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'percentile';
  calculation: {
    formula: string;
    dependencies: string[];
    filters?: Record<string, any>;
  };
  thresholds: {
    target?: number;
    warning?: number;
    critical?: number;
  };
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Report Configuration
```typescript
interface ReportConfiguration {
  id: string;
  name: string;
  description: string;
  type: 'dashboard' | 'scheduled' | 'adhoc';
  createdBy: string;
  facilityId: string;
  isPublic: boolean;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string; // HH:MM format
    timezone: string;
    recipients: string[];
    format: 'pdf' | 'excel' | 'csv' | 'json';
  };
  parameters: {
    dateRange: {
      type: 'relative' | 'absolute';
      value: string; // "last_30_days" or specific dates
    };
    filters: Record<string, any>;
    groupBy: string[];
    metrics: string[];
  };
  visualization: {
    charts: Array<{
      type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap';
      metrics: string[];
      dimensions: string[];
      styling: Record<string, any>;
    }>;
    layout: {
      columns: number;
      spacing: number;
      showLegend: boolean;
    };
  };
  lastGenerated?: Date;
  lastModified: Date;
}
```

## Service Implementation

### Analytics Engine
```typescript
export class AnalyticsEngine {
  constructor(
    private eventStore: EventStore,
    private metricsCalculator: MetricsCalculator,
    private dataWarehouse: DataWarehouse,
    private mlService: MachineLearningService
  ) {}

  async processRealTimeEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Validate and enrich event
      const enrichedEvent = await this.enrichEvent(event);
      
      // Store in event store
      await this.eventStore.append(enrichedEvent);
      
      // Update real-time metrics
      await this.updateRealTimeMetrics(enrichedEvent);
      
      // Trigger alerts if thresholds exceeded
      await this.checkAlertThresholds(enrichedEvent);
      
      // Update ML models with new data
      await this.updateMlModels(enrichedEvent);
      
    } catch (error) {
      console.error(`Failed to process analytics event ${event.id}:`, error);
      await this.handleEventProcessingError(event, error);
    }
  }

  private async enrichEvent(event: AnalyticsEvent): Promise<AnalyticsEvent> {
    const enriched = { ...event };
    
    // Add facility context
    if (event.facilityId) {
      const facility = await this.getFacilityInfo(event.facilityId);
      enriched.metadata.facilityContext = {
        name: facility.name,
        type: facility.type,
        size: facility.size,
        location: facility.location
      };
    }

    // Add temporal context
    enriched.metadata.temporalContext = {
      hour: event.timestamp.getHours(),
      dayOfWeek: event.timestamp.getDay(),
      month: event.timestamp.getMonth(),
      isHoliday: await this.isHoliday(event.timestamp),
      isWeekend: [0, 6].includes(event.timestamp.getDay())
    };

    // Add external context (weather, traffic)
    if (event.category === 'patient' && event.facilityId) {
      enriched.metadata.externalContext = await this.getExternalContext(
        event.facilityId,
        event.timestamp
      );
    }

    return enriched;
  }

  async calculateMetrics(
    facilityId: string,
    dateRange: DateRange,
    metrics: string[]
  ): Promise<MetricsResult> {
    const events = await this.eventStore.query({
      facilityId,
      dateRange,
      eventTypes: this.getEventTypesForMetrics(metrics)
    });

    const results: MetricsResult = {
      facilityId,
      dateRange,
      metrics: {},
      calculatedAt: new Date()
    };

    for (const metricId of metrics) {
      const definition = await this.getMetricDefinition(metricId);
      const value = await this.metricsCalculator.calculate(definition, events);
      
      results.metrics[metricId] = {
        value,
        unit: definition.unit,
        threshold: definition.thresholds,
        trend: await this.calculateTrend(metricId, facilityId, dateRange)
      };
    }

    return results;
  }

  async generatePredictiveForecast(
    facilityId: string,
    forecastType: 'patient_volume' | 'wait_times' | 'staff_needs',
    horizon: number // days into the future
  ): Promise<ForecastResult> {
    const historicalData = await this.getHistoricalDataForForecast(
      facilityId,
      forecastType,
      90 // 90 days of history
    );

    const forecast = await this.mlService.generateForecast({
      data: historicalData,
      horizon,
      seasonality: true,
      externalFactors: await this.getExternalFactors(facilityId, horizon)
    });

    return {
      facilityId,
      forecastType,
      horizon,
      predictions: forecast.predictions,
      confidence: forecast.confidence,
      factors: forecast.influencingFactors,
      recommendations: await this.generateForecastRecommendations(forecast),
      generatedAt: new Date()
    };
  }
}
```

### Report Generation Service
```typescript
export class ReportGenerationService {
  constructor(
    private analyticsEngine: AnalyticsEngine,
    private templateEngine: TemplateEngine,
    private exportService: ExportService,
    private schedulerService: SchedulerService
  ) {}

  async generateReport(reportConfig: ReportConfiguration): Promise<GeneratedReport> {
    const startTime = Date.now();
    
    try {
      // Gather data based on report configuration
      const data = await this.gatherReportData(reportConfig);
      
      // Apply calculations and transformations
      const processedData = await this.processReportData(data, reportConfig);
      
      // Generate visualizations
      const charts = await this.generateCharts(processedData, reportConfig.visualization);
      
      // Render report using template
      const reportContent = await this.templateEngine.render(reportConfig, {
        data: processedData,
        charts,
        metadata: {
          generatedAt: new Date(),
          generationTime: Date.now() - startTime,
          dataRange: reportConfig.parameters.dateRange,
          facilityId: reportConfig.facilityId
        }
      });

      // Export to requested format
      const exportedReport = await this.exportService.export(
        reportContent,
        reportConfig.schedule?.format || 'pdf'
      );

      const generatedReport: GeneratedReport = {
        id: this.generateId(),
        configurationId: reportConfig.id,
        content: reportContent,
        exportedFile: exportedReport,
        metadata: {
          generationTime: Date.now() - startTime,
          dataPoints: processedData.totalDataPoints,
          fileSize: exportedReport.sizeBytes
        },
        generatedAt: new Date()
      };

      // Send to recipients if scheduled
      if (reportConfig.schedule?.recipients) {
        await this.distributeReport(generatedReport, reportConfig.schedule.recipients);
      }

      return generatedReport;
      
    } catch (error) {
      console.error(`Failed to generate report ${reportConfig.id}:`, error);
      throw new ReportGenerationError(reportConfig.id, error.message);
    }
  }

  private async gatherReportData(config: ReportConfiguration): Promise<ReportData> {
    const { dateRange, filters, metrics } = config.parameters;
    
    // Calculate absolute date range
    const absoluteDateRange = this.calculateAbsoluteDateRange(dateRange);
    
    // Gather metrics data
    const metricsData = await this.analyticsEngine.calculateMetrics(
      config.facilityId,
      absoluteDateRange,
      metrics
    );

    // Gather dimensional data for grouping
    const dimensionalData = await this.gatherDimensionalData(
      config.facilityId,
      absoluteDateRange,
      config.parameters.groupBy
    );

    // Apply filters
    const filteredData = this.applyFilters(metricsData, dimensionalData, filters);

    return {
      metrics: filteredData.metrics,
      dimensions: filteredData.dimensions,
      dateRange: absoluteDateRange,
      totalDataPoints: filteredData.totalDataPoints,
      aggregationLevel: this.determineAggregationLevel(absoluteDateRange)
    };
  }

  async scheduleReport(reportConfig: ReportConfiguration): Promise<void> {
    if (!reportConfig.schedule) {
      throw new Error('Report configuration missing schedule information');
    }

    const cronExpression = this.convertToCronExpression(reportConfig.schedule);
    
    await this.schedulerService.schedule(
      `generate-report-${reportConfig.id}`,
      cronExpression,
      {
        reportConfigId: reportConfig.id,
        action: 'generate_and_distribute'
      }
    );
  }

  private async generateCharts(
    data: ReportData,
    visualization: any
  ): Promise<ChartDefinition[]> {
    const charts: ChartDefinition[] = [];

    for (const chartConfig of visualization.charts) {
      const chartData = this.prepareChartData(data, chartConfig);
      
      const chart: ChartDefinition = {
        id: this.generateId(),
        type: chartConfig.type,
        title: this.generateChartTitle(chartConfig),
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          ...chartConfig.styling
        }
      };

      charts.push(chart);
    }

    return charts;
  }
}
```

### Metrics Calculation Service
```typescript
export class MetricsCalculator {
  constructor(
    private eventStore: EventStore,
    private cacheService: CacheService
  ) {}

  async calculate(
    definition: MetricDefinition,
    events: AnalyticsEvent[]
  ): Promise<MetricValue> {
    // Check cache first for expensive calculations
    const cacheKey = this.generateCacheKey(definition, events);
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Filter events based on metric requirements
    const relevantEvents = this.filterEventsForMetric(events, definition);
    
    // Calculate metric value based on type
    let value: number;
    
    switch (definition.type) {
      case 'counter':
        value = await this.calculateCounter(relevantEvents, definition);
        break;
      case 'gauge':
        value = await this.calculateGauge(relevantEvents, definition);
        break;
      case 'histogram':
        value = await this.calculateHistogram(relevantEvents, definition);
        break;
      case 'timer':
        value = await this.calculateTimer(relevantEvents, definition);
        break;
      default:
        throw new Error(`Unsupported metric type: ${definition.type}`);
    }

    const result: MetricValue = {
      value,
      unit: definition.unit,
      timestamp: new Date(),
      sampleSize: relevantEvents.length,
      confidence: this.calculateConfidence(relevantEvents.length)
    };

    // Cache result for 5 minutes
    await this.cacheService.setex(cacheKey, 300, JSON.stringify(result));

    return result;
  }

  private async calculateCounter(
    events: AnalyticsEvent[],
    definition: MetricDefinition
  ): Promise<number> {
    // Simple count of events
    if (definition.calculation.formula === 'count') {
      return events.length;
    }

    // Sum of specific field values
    if (definition.calculation.formula.startsWith('sum(')) {
      const field = this.extractFieldFromFormula(definition.calculation.formula);
      return events.reduce((sum, event) => {
        const value = this.getEventFieldValue(event, field);
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);
    }

    throw new Error(`Unsupported counter formula: ${definition.calculation.formula}`);
  }

  private async calculateGauge(
    events: AnalyticsEvent[],
    definition: MetricDefinition
  ): Promise<number> {
    if (events.length === 0) return 0;

    const field = this.extractFieldFromFormula(definition.calculation.formula);
    const values = events
      .map(event => this.getEventFieldValue(event, field))
      .filter(value => typeof value === 'number') as number[];

    switch (definition.aggregation) {
      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      default:
        return values[values.length - 1]; // Latest value
    }
  }

  private async calculateTimer(
    events: AnalyticsEvent[],
    definition: MetricDefinition
  ): Promise<number> {
    // Calculate time-based metrics (durations, intervals)
    const durations: number[] = [];

    // Group events by session or patient to calculate durations
    const groupedEvents = this.groupEventsBySession(events);

    for (const sessionEvents of groupedEvents) {
      const duration = this.calculateSessionDuration(sessionEvents, definition);
      if (duration > 0) {
        durations.push(duration);
      }
    }

    if (durations.length === 0) return 0;

    switch (definition.aggregation) {
      case 'avg':
        return durations.reduce((sum, val) => sum + val, 0) / durations.length;
      case 'percentile':
        return this.calculatePercentile(durations, 95); // 95th percentile
      case 'min':
        return Math.min(...durations);
      case 'max':
        return Math.max(...durations);
      default:
        return durations.reduce((sum, val) => sum + val, 0) / durations.length;
    }
  }
}
```

### Data Warehouse ETL Service
```typescript
export class DataWarehouseETL {
  constructor(
    private eventStore: EventStore,
    private dataWarehouse: DataWarehouse,
    private transformationRules: TransformationRulesEngine
  ) {}

  async runDailyETL(facilityId: string, date: Date): Promise<ETLResult> {
    const startTime = Date.now();
    const etlJob: ETLJob = {
      id: this.generateJobId(),
      facilityId,
      date,
      status: 'running',
      startTime: new Date(),
      metrics: {
        eventsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: 0
      }
    };

    try {
      // Extract events from the specified date
      const events = await this.extractDailyEvents(facilityId, date);
      etlJob.metrics.eventsProcessed = events.length;

      // Transform events into warehouse format
      const transformedData = await this.transformEvents(events);

      // Load into data warehouse
      const loadResult = await this.loadToWarehouse(transformedData);
      etlJob.metrics.recordsCreated = loadResult.created;
      etlJob.metrics.recordsUpdated = loadResult.updated;

      // Generate daily aggregations
      await this.generateDailyAggregations(facilityId, date);

      // Update job status
      etlJob.status = 'completed';
      etlJob.endTime = new Date();
      etlJob.duration = Date.now() - startTime;

      await this.saveETLJob(etlJob);

      return {
        success: true,
        jobId: etlJob.id,
        metrics: etlJob.metrics,
        duration: etlJob.duration
      };

    } catch (error) {
      etlJob.status = 'failed';
      etlJob.endTime = new Date();
      etlJob.error = error.message;

      await this.saveETLJob(etlJob);
      
      // Alert administrators of ETL failure
      await this.alertService.sendETLFailureAlert(facilityId, etlJob);

      throw error;
    }
  }

  private async transformEvents(events: AnalyticsEvent[]): Promise<WarehouseRecord[]> {
    const records: WarehouseRecord[] = [];

    for (const event of events) {
      const transformationRule = await this.transformationRules.getRule(event.eventType);
      
      if (transformationRule) {
        const transformed = await this.applyTransformation(event, transformationRule);
        records.push(...transformed);
      }
    }

    return records;
  }

  private async generateDailyAggregations(facilityId: string, date: Date): Promise<void> {
    const aggregations = [
      {
        name: 'daily_queue_metrics',
        query: `
          SELECT 
            queue_id,
            DATE(timestamp) as date,
            COUNT(*) as total_patients,
            AVG(wait_time_minutes) as avg_wait_time,
            MAX(wait_time_minutes) as max_wait_time,
            COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_shows
          FROM patient_queue_events 
          WHERE facility_id = ? AND DATE(timestamp) = ?
          GROUP BY queue_id, DATE(timestamp)
        `
      },
      {
        name: 'daily_staff_metrics',
        query: `
          SELECT 
            staff_id,
            DATE(timestamp) as date,
            COUNT(DISTINCT patient_id) as patients_served,
            AVG(service_duration_minutes) as avg_service_time,
            SUM(service_duration_minutes) as total_service_time
          FROM staff_patient_events 
          WHERE facility_id = ? AND DATE(timestamp) = ?
          GROUP BY staff_id, DATE(timestamp)
        `
      }
    ];

    for (const aggregation of aggregations) {
      await this.dataWarehouse.execute(aggregation.query, [facilityId, date]);
    }
  }
}
```

### Machine Learning Analytics Service
```typescript
export class MLAnalyticsService {
  constructor(
    private mlPlatform: MLPlatform,
    private dataWarehouse: DataWarehouse
  ) {}

  async detectAnomalies(
    facilityId: string,
    metricType: string,
    timeWindow: number = 24 // hours
  ): Promise<AnomalyDetectionResult> {
    const historicalData = await this.getHistoricalMetricData(
      facilityId,
      metricType,
      30 // 30 days of history
    );

    const recentData = await this.getRecentMetricData(
      facilityId,
      metricType,
      timeWindow
    );

    const anomalies = await this.mlPlatform.detectAnomalies({
      historical: historicalData,
      current: recentData,
      algorithm: 'isolation_forest',
      sensitivity: 0.95
    });

    return {
      facilityId,
      metricType,
      timeWindow,
      anomalies: anomalies.map(anomaly => ({
        timestamp: anomaly.timestamp,
        value: anomaly.value,
        expectedRange: anomaly.expectedRange,
        severity: anomaly.severity,
        confidence: anomaly.confidence,
        possibleCauses: this.identifyPossibleCauses(anomaly, historicalData)
      })),
      detectedAt: new Date()
    };
  }

  async generateInsights(
    facilityId: string,
    timeRange: DateRange
  ): Promise<AnalyticsInsights> {
    const data = await this.gatherInsightData(facilityId, timeRange);
    
    const insights = await this.mlPlatform.generateInsights({
      data,
      analysisTypes: [
        'performance_trends',
        'efficiency_opportunities',
        'patient_satisfaction_drivers',
        'resource_optimization',
        'predictive_capacity_planning'
      ]
    });

    return {
      facilityId,
      timeRange,
      insights: insights.map(insight => ({
        type: insight.type,
        title: insight.title,
        description: insight.description,
        impact: insight.quantifiedImpact,
        recommendations: insight.actionableRecommendations,
        confidence: insight.confidence,
        supportingData: insight.evidencePoints
      })),
      generatedAt: new Date()
    };
  }

  async trainPredictiveModels(facilityId: string): Promise<ModelTrainingResult> {
    const trainingData = await this.gatherTrainingData(facilityId);
    
    const models = [
      {
        name: 'wait_time_prediction',
        type: 'regression',
        target: 'actual_wait_time',
        features: [
          'queue_position',
          'time_of_day',
          'day_of_week',
          'appointment_type',
          'staff_count',
          'historical_avg'
        ]
      },
      {
        name: 'patient_volume_forecast',
        type: 'time_series',
        target: 'daily_patient_count',
        features: [
          'day_of_week',
          'month',
          'weather',
          'local_events',
          'historical_trends'
        ]
      },
      {
        name: 'no_show_prediction',
        type: 'classification',
        target: 'will_show',
        features: [
          'appointment_type',
          'lead_time',
          'patient_history',
          'weather',
          'time_of_day'
        ]
      }
    ];

    const results: ModelTrainingResult[] = [];

    for (const modelConfig of models) {
      const result = await this.mlPlatform.trainModel({
        name: modelConfig.name,
        facilityId,
        data: trainingData,
        configuration: modelConfig,
        validationSplit: 0.2,
        testSplit: 0.1
      });

      results.push(result);

      if (result.performance.accuracy > 0.8) {
        await this.deployModel(facilityId, modelConfig.name, result.modelId);
      }
    }

    return {
      facilityId,
      modelsTrained: results.length,
      modelsDeployed: results.filter(r => r.performance.accuracy > 0.8).length,
      results,
      trainedAt: new Date()
    };
  }
}
```

### Real-Time Analytics Dashboard
```typescript
export class RealTimeAnalyticsDashboard {
  constructor(
    private analyticsEngine: AnalyticsEngine,
    private webSocketService: WebSocketService
  ) {}

  async initializeDashboard(userId: string, facilityId: string): Promise<DashboardState> {
    const user = await this.getUserPermissions(userId);
    const widgets = await this.getWidgetsForRole(user.role, facilityId);
    
    const dashboardState: DashboardState = {
      userId,
      facilityId,
      widgets,
      lastUpdated: new Date(),
      updateInterval: 5000, // 5 seconds
      isRealTime: true
    };

    // Subscribe to real-time updates
    await this.subscribeToUpdates(userId, facilityId);

    return dashboardState;
  }

  async updateDashboardMetrics(
    facilityId: string,
    metricsToUpdate: string[]
  ): Promise<void> {
    const updatedMetrics: Record<string, any> = {};

    for (const metricId of metricsToUpdate) {
      try {
        const metricValue = await this.analyticsEngine.calculateRealTimeMetric(
          facilityId,
          metricId
        );
        updatedMetrics[metricId] = metricValue;
      } catch (error) {
        console.error(`Failed to update metric ${metricId}:`, error);
        updatedMetrics[metricId] = { error: error.message };
      }
    }

    // Broadcast updates to connected dashboards
    this.webSocketService.broadcast(`facility:${facilityId}`, {
      type: 'metrics_updated',
      metrics: updatedMetrics,
      timestamp: new Date()
    });
  }

  async createCustomWidget(
    userId: string,
    widgetConfig: CustomWidgetConfig
  ): Promise<DashboardWidget> {
    const widget: DashboardWidget = {
      id: this.generateId(),
      name: widgetConfig.name,
      type: widgetConfig.type,
      createdBy: userId,
      configuration: {
        metrics: widgetConfig.metrics,
        timeRange: widgetConfig.timeRange,
        filters: widgetConfig.filters,
        visualization: widgetConfig.visualization
      },
      position: widgetConfig.position,
      size: widgetConfig.size,
      isPublic: widgetConfig.isPublic || false,
      createdAt: new Date()
    };

    await this.saveWidget(widget);

    // Generate initial data for the widget
    const initialData = await this.generateWidgetData(widget);
    widget.data = initialData;

    return widget;
  }

  private async generateWidgetData(widget: DashboardWidget): Promise<any> {
    const { metrics, timeRange, filters } = widget.configuration;
    
    const dateRange = this.parseDateRange(timeRange);
    const metricsData = await this.analyticsEngine.calculateMetrics(
      widget.facilityId,
      dateRange,
      metrics
    );

    // Transform data for visualization
    return this.transformDataForVisualization(
      metricsData,
      widget.configuration.visualization
    );
  }
}
```

### Export and Integration Service
```typescript
export class AnalyticsExportService {
  constructor(
    private reportGenerator: ReportGenerator,
    private fileStorage: FileStorage,
    private emailService: EmailService
  ) {}

  async exportData(
    facilityId: string,
    exportRequest: DataExportRequest
  ): Promise<ExportResult> {
    // Validate export permissions
    await this.validateExportPermissions(exportRequest.userId, facilityId);

    // Gather requested data
    const data = await this.gatherExportData(facilityId, exportRequest);

    // Apply data anonymization if required
    const processedData = await this.processForExport(data, exportRequest.privacyLevel);

    // Generate export file
    const exportFile = await this.generateExportFile(processedData, exportRequest.format);

    // Store securely
    const fileUrl = await this.fileStorage.store(exportFile, {
      encryption: true,
      expiresIn: 24 * 60 * 60 * 1000, // 24 hours
      accessControls: [exportRequest.userId]
    });

    // Send notification
    if (exportRequest.notifyWhenComplete) {
      await this.emailService.sendExportNotification(exportRequest.userId, {
        downloadUrl: fileUrl,
        fileName: exportFile.name,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }

    return {
      exportId: this.generateId(),
      fileUrl,
      fileName: exportFile.name,
      fileSize: exportFile.size,
      recordCount: processedData.length,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date()
    };
  }

  async integrateWithBI(
    facilityId: string,
    biTool: 'tableau' | 'powerbi' | 'looker',
    integrationConfig: BIIntegrationConfig
  ): Promise<void> {
    switch (biTool) {
      case 'tableau':
        await this.setupTableauIntegration(facilityId, integrationConfig);
        break;
      case 'powerbi':
        await this.setupPowerBIIntegration(facilityId, integrationConfig);
        break;
      case 'looker':
        await this.setupLookerIntegration(facilityId, integrationConfig);
        break;
    }
  }

  private async setupTableauIntegration(
    facilityId: string,
    config: BIIntegrationConfig
  ): Promise<void> {
    // Create Tableau data source
    const dataSource = {
      name: `Healthcare_Queue_${facilityId}`,
      connectionType: 'postgres',
      server: config.databaseHost,
      database: config.databaseName,
      schema: 'analytics',
      tables: [
        'daily_queue_metrics',
        'patient_flow_events',
        'staff_performance_metrics',
        'facility_utilization_stats'
      ]
    };

    // Generate Tableau workbook template
    const workbook = await this.generateTableauWorkbook(facilityId, dataSource);
    
    // Deploy to Tableau Server
    await this.deployTableauWorkbook(workbook, config.tableauServer);
  }
}
```

## Performance Optimization

### Data Processing Optimization
```typescript
export class AnalyticsPerformanceOptimizer {
  constructor(
    private cacheService: CacheService,
    private queryOptimizer: QueryOptimizer
  ) {}

  async optimizeQuery(query: AnalyticsQuery): Promise<OptimizedQuery> {
    // Analyze query patterns and optimize
    const optimizations = await this.queryOptimizer.analyze(query);
    
    const optimizedQuery: OptimizedQuery = {
      ...query,
      indexHints: optimizations.recommendedIndexes,
      cacheStrategy: this.determineCacheStrategy(query),
      partitionPruning: optimizations.partitionPruning,
      aggregationLevel: this.determineOptimalAggregation(query)
    };

    return optimizedQuery;
  }

  async implementCachingStrategy(metricId: string, facilityId: string): Promise<void> {
    const metric = await this.getMetricDefinition(metricId);
    
    // Determine caching strategy based on metric characteristics
    const strategy = {
      ttl: this.calculateOptimalTTL(metric),
      refreshStrategy: this.determineRefreshStrategy(metric),
      invalidationTriggers: this.identifyInvalidationTriggers(metric)
    };

    await this.cacheService.configure(`metric:${metricId}:${facilityId}`, strategy);
  }

  private calculateOptimalTTL(metric: MetricDefinition): number {
    // Real-time metrics: short TTL
    if (metric.category === 'operational' && metric.type === 'gauge') {
      return 30; // 30 seconds
    }
    
    // Historical metrics: longer TTL
    if (metric.category === 'quality' || metric.category === 'satisfaction') {
      return 3600; // 1 hour
    }
    
    // Default: 5 minutes
    return 300;
  }
}
```